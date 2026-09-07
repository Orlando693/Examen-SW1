import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UmlEditorClient } from './UmlEditorClient';
import { resetEditorStoreForTests, useEditorStore } from '../../stores/editor-store';
import { createDemoProjectDocument } from '../../lib/editor/demo/demo-document';
import { UmlClassNode } from './nodes/UmlClassNode';
import { UmlEnumNode } from './nodes/UmlEnumNode';

const fitViewMock = vi.hoisted(() => vi.fn());
const reactFlowLifecycle = vi.hoisted(() => ({ mounts: 0, unmounts: 0 }));

vi.mock('@xyflow/react', async () => {
  const React = await import('react');
  return {
    Background: () => <div data-testid="flow-background" />,
    BaseEdge: () => <div data-testid="base-edge" />,
    Controls: () => <div data-testid="flow-controls">zoom pan fit view</div>,
    EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    getBezierPath: () => ['M0,0 C10,10 20,20 30,30', 15, 15],
    Handle: () => <span data-testid="handle" />,
    MiniMap: () => <div data-testid="flow-minimap" />,
    Position: { Left: 'left', Right: 'right' },
    ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    useReactFlow: () => ({ fitView: fitViewMock }),
    ReactFlow: ({ nodes, edges, onInit, onNodeClick, onNodeDragStop, onEdgeClick, onSelectionChange, children }: { nodes: Array<{ id: string; type?: string; data: { name?: string } }>; edges: Array<{ id: string; label?: string }>; onInit?: (instance: { fitView: typeof fitViewMock }) => void; onNodeClick: (event: MouseEvent, node: { id: string; type?: string }) => void; onNodeDragStop: (event: MouseEvent, node: { id: string; position: { x: number; y: number } }) => void; onEdgeClick?: (event: MouseEvent, edge: { id: string }) => void; onSelectionChange?: (params: { nodes: unknown[]; edges: unknown[] }) => void; children: React.ReactNode }) => {
      React.useEffect(() => {
        reactFlowLifecycle.mounts += 1;
        return () => {
          reactFlowLifecycle.unmounts += 1;
        };
      }, []);
      React.useEffect(() => {
        onInit?.({ fitView: fitViewMock });
        onSelectionChange?.({ nodes: [], edges: [] });
      }, [onInit, onSelectionChange]);
      return (
        <div data-testid="react-flow">
          {nodes.map((node) => (
            <button key={node.id} data-testid={`flow-node-${node.id}`} onClick={() => onNodeClick(new MouseEvent('click'), node)} onDoubleClick={() => onNodeDragStop(new MouseEvent('mouseup'), { id: node.id, position: { x: 500, y: 600 } })}>
              {node.data.name}
            </button>
          ))}
          {edges.map((edge) => <button key={edge.id} data-testid={`flow-edge-${edge.id}`} onClick={() => onEdgeClick?.(new MouseEvent('click'), edge)}>{edge.label}</button>)}
          {children}
        </div>
      );
    },
  };
});

vi.mock('../../lib/editor/layout/auto-layout', () => ({
  createAutoLayoutCommand: vi.fn(async () => ({
    type: 'ApplyLayout',
    updates: [
      { elementId: 'class-customer', position: { x: 10, y: 20 } },
      { elementId: 'class-order', position: { x: 300, y: 20 } },
    ],
  })),
}));

describe('UmlEditorClient', () => {
  const originalResizeObserver = globalThis.ResizeObserver;
  let resizeObserverCallbacks: ResizeObserverCallback[];
  const relationshipTools = [
    { label: 'Asociación', kind: 'association', sourceId: 'class-customer', targetId: 'class-order' },
    { label: 'Agregación', kind: 'aggregation', sourceId: 'class-customer', targetId: 'class-invoice' },
    { label: 'Composición', kind: 'composition', sourceId: 'class-order', targetId: 'class-invoice' },
    { label: 'Herencia', kind: 'generalization', sourceId: 'class-priority-order', targetId: 'class-customer' },
  ] as const;

  beforeEach(() => {
    fitViewMock.mockClear();
    reactFlowLifecycle.mounts = 0;
    reactFlowLifecycle.unmounts = 0;
    resizeObserverCallbacks = [];
    globalThis.ResizeObserver = class ResizeObserver {
      private readonly callback: ResizeObserverCallback;

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
      }

      observe(target: Element) {
        Object.defineProperties(target, {
          clientWidth: { configurable: true, value: 900 },
          clientHeight: { configurable: true, value: 600 },
          offsetWidth: { configurable: true, value: 900 },
          offsetHeight: { configurable: true, value: 600 },
        });
        resizeObserverCallbacks.push(this.callback);
        this.callback([{ target, contentRect: { width: 900, height: 600 } as DOMRectReadOnly } as ResizeObserverEntry], this);
      }

      disconnect() {}
      unobserve() {}
    };
  });

  afterEach(() => {
    globalThis.ResizeObserver = originalResizeObserver;
  });

  function chooseRelationshipTool(label: string) {
    fireEvent.click(screen.getByText('Relation'));
    fireEvent.click(screen.getByRole('menuitem', { name: label }));
  }

  it('renders the workspace shell, route-owned editor content and projected canvas', () => {
    resetEditorStoreForTests(createDemoProjectDocument());
    render(<UmlEditorClient />);

    expect(screen.getByTestId('editor-root')).toHaveStyle({ height: '100dvh', overflow: 'hidden' });
    expect(screen.getByTestId('uml-workspace')).toBeInTheDocument();
    expect(screen.getByTestId('editor-sidebar')).toHaveTextContent('LOCAL DEMO');
    expect(screen.getByTestId('editor-toolbox')).toBeInTheDocument();
    expect(screen.getByTestId('react-flow-host')).toHaveStyle({ position: 'absolute', inset: '0' });
    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    expect(screen.getByTestId('flow-node-class-customer')).toHaveTextContent('Customer');
    expect(screen.getByTestId('flow-node-enum-order-status')).toHaveTextContent('OrderStatus');
    expect(screen.getByTestId('flow-edge-rel-customer-orders')).toBeInTheDocument();
    expect(screen.getByTestId('flow-controls')).toHaveTextContent('zoom pan fit view');
  });

  it('keeps the server HTML on the desktop-safe branch before client hydration', () => {
    resetEditorStoreForTests(createDemoProjectDocument());

    const html = renderToString(<UmlEditorClient />);

    expect(html).toContain('CASE / UML / WORKBENCH');
    expect(html).toContain('Auto Layout');
    expect(html).not.toContain('aria-label="Menu"');
    expect(html).not.toContain('Props');
  });

  it('renders a readable desktop toolbox with complete labels and no horizontal scrolling mode', () => {
    resetEditorStoreForTests(createDemoProjectDocument());
    render(<UmlEditorClient />);

    const toolbox = screen.getByTestId('editor-toolbox');
    expect(toolbox).toHaveAttribute('data-compact', 'false');
    expect(toolbox).toHaveStyle({ transform: 'translateX(-50%)' });
    expect(screen.getByTestId('toolbox-group-elements')).toHaveTextContent('Clase');
    expect(screen.getByTestId('toolbox-group-relationships')).toHaveTextContent('Relation');
    for (const label of ['Select', 'Clase', 'Enum', 'Relation', 'Layout']) {
      expect(within(toolbox).getByText(label)).toBeInTheDocument();
    }
    fireEvent.click(within(toolbox).getByText('Relation'));
    for (const label of ['Asociación', 'Agregación', 'Composición', 'Herencia']) {
      expect(screen.getByRole('menuitem', { name: label })).toBeInTheDocument();
    }
  });

  it('shows contextual inspector sections and selected diagnostics', () => {
    resetEditorStoreForTests(createDemoProjectDocument());
    render(<UmlEditorClient />);

    expect(screen.getByTestId('inspector-panel')).toHaveTextContent('Nada seleccionado');

    fireEvent.click(screen.getByTestId('flow-node-class-invoice'));

    expect(screen.getByTestId('inspector-class-sections')).toHaveTextContent('General');
    expect(screen.getByTestId('inspector-class-sections')).toHaveTextContent('Attributes');
    expect(screen.getByTestId('inspector-diagnostics-section')).toHaveTextContent('Class names should start');
  });

  it('does not execute UML commands or update the store during initial render', () => {
    resetEditorStoreForTests(createDemoProjectDocument());
    const beforeClasses = useEditorStore.getState().currentDocument.model.classes.length;
    const beforeUndo = useEditorStore.getState().undoCount;
    let storeUpdates = 0;
    const unsubscribe = useEditorStore.subscribe(() => {
      storeUpdates += 1;
    });

    render(<UmlEditorClient />);

    unsubscribe();
    expect(storeUpdates).toBe(0);
    expect(useEditorStore.getState().currentDocument.model.classes).toHaveLength(beforeClasses);
    expect(useEditorStore.getState().undoCount).toBe(beforeUndo);
  });

  it('renders class and enum custom nodes', () => {
    render(<UmlClassNode id="class-a" type="umlClass" selected={false} dragging={false} draggable selectable deletable zIndex={0} isConnectable data={{ elementId: 'class-a', name: 'Customer', attributes: ['- name: string'], operations: ['+ displayName(): string'], errorCount: 0, warningCount: 0 }} positionAbsoluteX={0} positionAbsoluteY={0} />);
    expect(screen.getByTestId('uml-class-node')).toHaveTextContent('Customer');
    expect(screen.getByTestId('uml-class-node')).toHaveTextContent('CLASS');
    expect(screen.getByTestId('uml-class-node')).toHaveTextContent('- name');
    expect(screen.getByTestId('uml-class-node')).toHaveTextContent('string');

    render(<UmlEnumNode id="enum-a" type="umlEnum" selected={false} dragging={false} draggable selectable deletable zIndex={0} isConnectable data={{ elementId: 'enum-a', name: 'Status', literals: [{ id: 'literal-open', name: 'OPEN' }], errorCount: 0, warningCount: 0 }} positionAbsoluteX={0} positionAbsoluteY={0} />);
    expect(screen.getByTestId('uml-enum-node')).toHaveTextContent('Status');
    expect(screen.getByTestId('uml-enum-node')).toHaveTextContent('OPEN');
  });

  it('renders duplicate enum literal names without duplicate React keys', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(<UmlEnumNode id="enum-a" type="umlEnum" selected={false} dragging={false} draggable selectable deletable zIndex={0} isConnectable data={{ elementId: 'enum-a', name: 'Status', literals: [{ id: 'literal-a', name: 'NEW_LITERAL' }, { id: 'literal-b', name: 'NEW_LITERAL' }], errorCount: 0, warningCount: 0 }} positionAbsoluteX={0} positionAbsoluteY={0} />);

    expect(screen.getAllByText('NEW_LITERAL')).toHaveLength(2);
    expect(consoleError).not.toHaveBeenCalledWith(expect.stringContaining('Encountered two children with the same key'));
    consoleError.mockRestore();
  });

  it('selects, renames and edits class attributes from the inspector', () => {
    resetEditorStoreForTests(createDemoProjectDocument());
    render(<UmlEditorClient />);

    fireEvent.click(screen.getByTestId('flow-node-class-customer'));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Client' } });
    fireEvent.click(screen.getByText('Renombrar'));
    expect(useEditorStore.getState().currentDocument.model.classes.find((umlClass) => umlClass.id === 'class-customer')?.name).toBe('Client');

    fireEvent.click(screen.getByText('Agregar atributo'));
    const added = useEditorStore.getState().currentDocument.model.classes.find((umlClass) => umlClass.id === 'class-customer')?.attributes.at(-1);
    expect(added?.name).toBe('newAttribute');
    expect(added?.type).toEqual({ kind: 'primitive', name: 'string' });

    fireEvent.change(screen.getByLabelText(`attribute-${added?.id}`), { target: { value: 'phone' } });
    fireEvent.blur(screen.getByLabelText(`attribute-${added?.id}`));
    expect(useEditorStore.getState().currentDocument.model.classes.find((umlClass) => umlClass.id === 'class-customer')?.attributes.at(-1)?.name).toBe('phone');

    fireEvent.change(screen.getByLabelText(`attribute-type-${added?.id}`), { target: { value: 'primitive:number' } });
    expect(useEditorStore.getState().currentDocument.model.classes.find((umlClass) => umlClass.id === 'class-customer')?.attributes.at(-1)?.type).toEqual({ kind: 'primitive', name: 'number' });
  });

  it('edits enumerations and relationships from UI actions', () => {
    resetEditorStoreForTests(createDemoProjectDocument());
    render(<UmlEditorClient />);

    fireEvent.click(screen.getByText('Enum'));
    expect(useEditorStore.getState().currentDocument.model.enumerations.some((enumeration) => enumeration.name === 'NewEnum')).toBe(true);

    fireEvent.click(screen.getByTestId('flow-node-enum-order-status'));
    fireEvent.click(screen.getByText('Agregar literal'));
    expect(useEditorStore.getState().currentDocument.model.enumerations.find((enumeration) => enumeration.id === 'enum-order-status')?.literals.some((literal) => literal.name === 'NEW_LITERAL')).toBe(true);
    const addedLiteral = useEditorStore.getState().currentDocument.model.enumerations.find((enumeration) => enumeration.id === 'enum-order-status')?.literals.at(-1);
    const literalInput = screen.getByLabelText(`literal-${addedLiteral?.id}`);
    fireEvent.change(literalInput, { target: { value: 'PENDING' } });
    fireEvent.blur(literalInput);
    expect(useEditorStore.getState().currentDocument.model.enumerations.find((enumeration) => enumeration.id === 'enum-order-status')?.literals.some((literal) => literal.name === 'PENDING')).toBe(true);
    fireEvent.click(screen.getAllByText('Quitar').at(-1)!);
    expect(useEditorStore.getState().currentDocument.model.enumerations.find((enumeration) => enumeration.id === 'enum-order-status')?.literals.some((literal) => literal.id === addedLiteral?.id)).toBe(false);

    chooseRelationshipTool('Herencia');
    fireEvent.click(screen.getByTestId('flow-node-class-priority-order'));
    fireEvent.click(screen.getByTestId('flow-node-class-customer'));
    expect(useEditorStore.getState().currentDocument.model.relationships.some((relationship) => relationship.kind === 'generalization' && relationship.target.classId === 'class-customer')).toBe(true);
  });

  it.each(relationshipTools)('creates $kind from UI source to target and cleans draft state', ({ label, kind, sourceId, targetId }) => {
    resetEditorStoreForTests(createDemoProjectDocument());
    render(<UmlEditorClient />);
    const beforeCount = useEditorStore.getState().currentDocument.model.relationships.length;

    chooseRelationshipTool(label);
    expect(screen.getByTestId('relationship-feedback')).toHaveTextContent('Choose source');

    fireEvent.click(screen.getByTestId(`flow-node-${sourceId}`));
    expect(useEditorStore.getState().relationshipDraft?.sourceClassId).toBe(sourceId);
    expect(screen.getByTestId('relationship-feedback')).toHaveTextContent('Choose target');

    fireEvent.click(screen.getByTestId(`flow-node-${targetId}`));

    const relationships = useEditorStore.getState().currentDocument.model.relationships;
    expect(relationships).toHaveLength(beforeCount + 1);
    expect(relationships.at(-1)).toMatchObject({ kind, source: { classId: sourceId }, target: { classId: targetId } });
    expect(useEditorStore.getState().relationshipDraft).toBeNull();
    expect(useEditorStore.getState().activeTool).toBe('select');
    expect(screen.getByTestId(`flow-edge-${relationships.at(-1)?.id}`)).toBeInTheDocument();
  });

  it('rejects invalid self relationships without mutating the document', () => {
    resetEditorStoreForTests(createDemoProjectDocument());
    render(<UmlEditorClient />);
    const before = useEditorStore.getState().currentDocument;

    chooseRelationshipTool('Agregación');
    fireEvent.click(screen.getByTestId('flow-node-class-customer'));
    fireEvent.click(screen.getByTestId('flow-node-class-customer'));

    expect(useEditorStore.getState().currentDocument).toEqual(before);
    expect(useEditorStore.getState().relationshipDraft).toBeNull();
    expect(useEditorStore.getState().lastCommandError).toMatch(/si misma/);
  });

  it('cancels relationship creation with Selection tool and Escape', () => {
    resetEditorStoreForTests(createDemoProjectDocument());
    render(<UmlEditorClient />);

    chooseRelationshipTool('Agregación');
    fireEvent.click(screen.getByTestId('flow-node-class-customer'));
    expect(useEditorStore.getState().relationshipDraft?.sourceClassId).toBe('class-customer');
    fireEvent.click(screen.getByText('Select'));
    expect(useEditorStore.getState().relationshipDraft).toBeNull();

    chooseRelationshipTool('Composición');
    fireEvent.click(screen.getByTestId('flow-node-class-order'));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useEditorStore.getState().relationshipDraft).toBeNull();
    expect(useEditorStore.getState().activeTool).toBe('select');
  });

  it('commits drag through MoveNode and keeps the semantic model unchanged', () => {
    resetEditorStoreForTests(createDemoProjectDocument());
    render(<UmlEditorClient />);
    const modelBefore = JSON.stringify(useEditorStore.getState().currentDocument.model);

    fireEvent.doubleClick(screen.getByTestId('flow-node-class-customer'));

    expect(useEditorStore.getState().currentDocument.layout.nodes.find((node) => node.elementId === 'class-customer')?.position).toEqual({ x: 500, y: 600 });
    expect(JSON.stringify(useEditorStore.getState().currentDocument.model)).toBe(modelBefore);
  });

  it('shows diagnostics and can navigate warnings to selected elements', () => {
    resetEditorStoreForTests(createDemoProjectDocument());
    render(<UmlEditorClient />);

    const panel = screen.getByTestId('diagnostics-panel');
    expect(panel).toHaveTextContent('WARNING');
    fireEvent.click(within(panel).getByText(/Class names should start/));
    expect(useEditorStore.getState().selection).toEqual({ type: 'class', id: 'class-invoice' });
  });

  it('exposes Undo and Redo controls from the shared history', () => {
    resetEditorStoreForTests(createDemoProjectDocument());
    render(<UmlEditorClient />);

    fireEvent.click(screen.getByText('Clase'));
    expect(useEditorStore.getState().undoCount).toBe(1);

    fireEvent.click(screen.getByText('Undo'));
    expect(useEditorStore.getState().redoCount).toBe(1);

    fireEvent.click(screen.getByText('Redo'));
    expect(useEditorStore.getState().redoCount).toBe(0);
  });

  it('uses compact drawers instead of fixed side columns on small viewports', () => {
    resetEditorStoreForTests(createDemoProjectDocument());
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('max-width'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    try {
      render(<UmlEditorClient />);

      expect(screen.getByRole('button', { name: 'Menu' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Props' })).toBeInTheDocument();
      expect(screen.getByTestId('uml-canvas')).toBeInTheDocument();
      expect(screen.getByTestId('uml-workspace')).toHaveAttribute('data-compact', 'true');
      expect(screen.getByTestId('editor-canvas-region')).toHaveStyle({ width: '100%' });
      expect(screen.getByTestId('uml-canvas')).toHaveStyle({ position: 'absolute', overflow: 'hidden' });
      expect(screen.getByTestId('react-flow-host')).toHaveStyle({ position: 'absolute', inset: '0' });
      expect(screen.getByTestId('editor-toolbox')).toHaveAttribute('data-compact', 'true');
      expect(screen.getByTestId('editor-toolbox')).toHaveStyle({ overflowX: 'auto', overflowY: 'hidden' });
      expect(screen.getByTestId('editor-toolbox')).toHaveTextContent('More');
      expect(screen.queryByText('Enum')).not.toBeInTheDocument();
      expect(screen.queryByTestId('flow-minimap')).not.toBeInTheDocument();
      expect(screen.queryByTestId('editor-sidebar')).not.toBeVisible();

      fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
      expect(screen.getByTestId('editor-sidebar')).toBeVisible();

      cleanup();
      resetEditorStoreForTests(createDemoProjectDocument());
      render(<UmlEditorClient />);

      fireEvent.click(screen.getByRole('button', { name: 'Props' }));
      expect(screen.getAllByText('Inspector').some((element) => element.textContent === 'Inspector')).toBe(true);
      expect(useEditorStore.getState().isInspectorOpen).toBe(true);
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('fits viewport on dimensioned mount without mutating ProjectDocument layout', async () => {
    resetEditorStoreForTests(createDemoProjectDocument());
    const beforeLayout = structuredClone(useEditorStore.getState().currentDocument.layout);
    fitViewMock.mockClear();

    render(<UmlEditorClient />);

    expect(useEditorStore.getState().currentDocument.layout).toEqual(beforeLayout);
    await waitFor(() => expect(fitViewMock).toHaveBeenCalled());
  });

  it('does not mount React Flow until its direct host has real dimensions', async () => {
    resetEditorStoreForTests(createDemoProjectDocument());
    globalThis.ResizeObserver = class ResizeObserver {
      private readonly callback: ResizeObserverCallback;

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
      }

      observe(target: Element) {
        Object.defineProperties(target, {
          clientWidth: { configurable: true, value: 0 },
          clientHeight: { configurable: true, value: 0 },
          offsetWidth: { configurable: true, value: 0 },
          offsetHeight: { configurable: true, value: 0 },
        });
        resizeObserverCallbacks.push(this.callback);
        this.callback([{ target, contentRect: { width: 900, height: 600 } as DOMRectReadOnly } as ResizeObserverEntry], this);
      }

      disconnect() {}
      unobserve() {}
    };

    render(<UmlEditorClient />);
    expect(screen.queryByTestId('react-flow')).not.toBeInTheDocument();

    const host = screen.getByTestId('react-flow-host');
    Object.defineProperties(host, {
      clientWidth: { configurable: true, value: 720 },
      clientHeight: { configurable: true, value: 480 },
      offsetWidth: { configurable: true, value: 720 },
      offsetHeight: { configurable: true, value: 480 },
    });
    act(() => {
      resizeObserverCallbacks.at(-1)?.([{ target: host, contentRect: { width: 720, height: 480 } as DOMRectReadOnly } as unknown as ResizeObserverEntry], {} as ResizeObserver);
    });

    await waitFor(() => expect(screen.getByTestId('react-flow')).toBeInTheDocument());
  });

  it('does not refit or write to the editor store when rerendering the same document and selection', async () => {
    resetEditorStoreForTests(createDemoProjectDocument());
    const { rerender } = render(<UmlEditorClient />);
    await waitFor(() => expect(fitViewMock).toHaveBeenCalledTimes(1));
    fitViewMock.mockClear();
    let storeUpdates = 0;
    const unsubscribe = useEditorStore.subscribe(() => {
      storeUpdates += 1;
    });

    rerender(<UmlEditorClient />);
    await act(async () => {
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
    });

    unsubscribe();
    expect(fitViewMock).not.toHaveBeenCalled();
    expect(storeUpdates).toBe(0);
    expect(reactFlowLifecycle.mounts).toBe(1);
    expect(reactFlowLifecycle.unmounts).toBe(0);
  });

  it('uses a readable minimum zoom for automatic mobile fitView', async () => {
    resetEditorStoreForTests(createDemoProjectDocument());
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('max-width'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    try {
      render(<UmlEditorClient />);
      await waitFor(() => expect(fitViewMock).toHaveBeenCalledWith(expect.objectContaining({ minZoom: 0.72, padding: 0.08 })));
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('ignores repeated ResizeObserver measurements with the same rounded size', async () => {
    resetEditorStoreForTests(createDemoProjectDocument());
    render(<UmlEditorClient />);
    await waitFor(() => expect(fitViewMock).toHaveBeenCalledTimes(1));
    fitViewMock.mockClear();
    let storeUpdates = 0;
    const unsubscribe = useEditorStore.subscribe(() => {
      storeUpdates += 1;
    });

    act(() => {
      resizeObserverCallbacks.at(-1)?.([{ contentRect: { width: 900.1, height: 600.2 } as DOMRectReadOnly } as ResizeObserverEntry], {} as ResizeObserver);
      resizeObserverCallbacks.at(-1)?.([{ contentRect: { width: 899.8, height: 600.1 } as DOMRectReadOnly } as ResizeObserverEntry], {} as ResizeObserver);
    });
    await act(async () => {
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
    });

    unsubscribe();
    expect(fitViewMock).not.toHaveBeenCalled();
    expect(storeUpdates).toBe(0);
  });

  it('keeps DiagramLayout unchanged when the canvas receives a real resize', async () => {
    resetEditorStoreForTests(createDemoProjectDocument());
    render(<UmlEditorClient />);
    await waitFor(() => expect(fitViewMock).toHaveBeenCalledTimes(1));
    fitViewMock.mockClear();
    const beforeLayout = structuredClone(useEditorStore.getState().currentDocument.layout);
    const host = screen.getByTestId('react-flow-host');

    act(() => {
      Object.defineProperties(host, {
        clientWidth: { configurable: true, value: 760 },
        clientHeight: { configurable: true, value: 540 },
        offsetWidth: { configurable: true, value: 760 },
        offsetHeight: { configurable: true, value: 540 },
      });
      resizeObserverCallbacks.at(-1)?.([{ contentRect: { width: 760, height: 540 } as DOMRectReadOnly } as ResizeObserverEntry], {} as ResizeObserver);
    });
    await waitFor(() => expect(fitViewMock).toHaveBeenCalledTimes(1));

    expect(useEditorStore.getState().currentDocument.layout).toEqual(beforeLayout);
  });

  it('keeps relationship mode active when React Flow emits selection changes before node clicks', () => {
    resetEditorStoreForTests(createDemoProjectDocument());
    render(<UmlEditorClient />);

    chooseRelationshipTool('Asociación');
    act(() => {
      useEditorStore.getState().setSelection(null);
    });
    fireEvent.click(screen.getByTestId('flow-node-class-customer'));
    expect(useEditorStore.getState().activeTool).toBe('association');
    expect(useEditorStore.getState().relationshipDraft).toEqual({ kind: 'association', sourceClassId: 'class-customer' });

    act(() => {
      useEditorStore.getState().setSelection({ type: 'class', id: 'class-order' });
    });
    fireEvent.click(screen.getByTestId('flow-node-class-order'));

    const relationship = useEditorStore.getState().currentDocument.model.relationships.at(-1);
    expect(relationship).toMatchObject({ kind: 'association', source: { classId: 'class-customer' }, target: { classId: 'class-order' } });
    expect(useEditorStore.getState().activeTool).toBe('select');
    expect(useEditorStore.getState().relationshipDraft).toBeNull();
  });

  it('opens compact More menu for enum creation and layout without permanent desktop controls', async () => {
    resetEditorStoreForTests(createDemoProjectDocument());
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('max-width'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    try {
      render(<UmlEditorClient />);
      expect(screen.queryByRole('button', { name: 'Auto Layout' })).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'More' }));
      fireEvent.click(screen.getByRole('menuitem', { name: 'Enum' }));
      expect(useEditorStore.getState().currentDocument.model.enumerations.some((enumeration) => enumeration.name === 'NewEnum')).toBe(true);

      fireEvent.click(screen.getByRole('button', { name: 'More' }));
      fireEvent.click(screen.getByRole('menuitem', { name: 'Layout' }));
      await waitFor(() => expect(useEditorStore.getState().undoCount).toBeGreaterThan(1));
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('shows selected element names in compact status instead of long ids', () => {
    resetEditorStoreForTests(createDemoProjectDocument());
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('max-width'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    try {
      render(<UmlEditorClient />);
      fireEvent.click(screen.getByTestId('flow-node-enum-order-status'));

      expect(screen.getByTestId('status-selection')).toHaveTextContent('ORDERSTATUS');
      expect(screen.getByTestId('status-selection')).not.toHaveTextContent('enum-order-status');
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });
});
