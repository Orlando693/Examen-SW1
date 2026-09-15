import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UmlEditorClient } from './UmlEditorClient';
import { UmlCanvas } from './UmlCanvas';
import { resetEditorStoreForTests, useEditorStore } from '../../stores/editor-store';
import { createDemoProjectDocument } from '../../lib/editor/demo/demo-document';
import { projectDocumentToFlow } from '../../lib/editor/projection/project-document-to-flow';
import { UmlClassNode } from './nodes/UmlClassNode';
import { UmlEnumNode } from './nodes/UmlEnumNode';
import { RealtimeCommandGate } from '../../lib/collaboration/realtime-command-gate';
import { clearAuthSession, setAuthSession } from '../../lib/auth/auth-session';

const fitViewMock = vi.hoisted(() => vi.fn());
const reactFlowLifecycle = vi.hoisted(() => ({ mounts: 0, unmounts: 0 }));
const projectApiMock = vi.hoisted(() => ({ get: vi.fn(), saveDocument: vi.fn() }));
const socketIoMock = vi.hoisted(() => {
  type Listener = (...args: unknown[]) => void;
  type Socket = { connected: boolean; listeners: Map<string, Set<Listener>>; emitted: Array<{ event: string; args: unknown[] }>; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> };
  const sockets: Socket[] = [];
  return {
    sockets,
    reset: () => { sockets.length = 0; },
    io: vi.fn(() => {
      const socket: Socket = { connected: false, listeners: new Map(), emitted: [], connect: vi.fn(), disconnect: vi.fn() };
      sockets.push(socket);
      const socketApi = {
        get connected() { return socket.connected; },
        on: (event: string, listener: Listener) => { const listeners = socket.listeners.get(event) ?? new Set<Listener>(); listeners.add(listener); socket.listeners.set(event, listeners); return socketApi; },
        off: (event: string, listener: Listener) => { socket.listeners.get(event)?.delete(listener); return socketApi; },
        emit: (event: string, ...args: unknown[]) => { socket.emitted.push({ event, args }); return socketApi; },
        connect: socket.connect,
        disconnect: socket.disconnect,
      };
      return socketApi;
    }),
  };
});

vi.mock('../../lib/projects/project-api', () => ({ projectApi: projectApiMock }));
vi.mock('socket.io-client', () => ({ io: socketIoMock.io }));

vi.mock('@xyflow/react', async () => {
  const React = await import('react');
  return {
    Background: () => <div data-testid="flow-background" />,
    BaseEdge: () => <div data-testid="base-edge" />,
    Controls: () => <div data-testid="flow-controls">zoom pan fit view</div>,
    EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    getSmoothStepPath: () => ['M0,0 L30,30', 15, 15],
    Handle: () => <span data-testid="handle" />,
    MiniMap: () => <div data-testid="flow-minimap" />,
    Position: { Left: 'left', Right: 'right' },
    ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    ViewportPortal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useReactFlow: () => ({ fitView: fitViewMock }),
    ReactFlow: ({ nodes, edges, onInit, onNodeClick, onNodeDragStart, onNodeDragStop, onEdgeClick, onSelectionChange, children }: { nodes: Array<{ id: string; type?: string; data: { name?: string } }>; edges: Array<{ id: string; label?: string }>; onInit?: (instance: { fitView: typeof fitViewMock }) => void; onNodeClick: (event: MouseEvent, node: { id: string; type?: string }) => void; onNodeDragStart?: (event: MouseEvent, node: { id: string; position: { x: number; y: number } }) => void; onNodeDragStop: (event: MouseEvent, node: { id: string; position: { x: number; y: number } }) => void; onEdgeClick?: (event: MouseEvent, edge: { id: string }) => void; onSelectionChange?: (params: { nodes: unknown[]; edges: unknown[] }) => void; children: React.ReactNode }) => {
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
            <button key={node.id} data-testid={`flow-node-${node.id}`} onClick={() => { onSelectionChange?.({ nodes: [node], edges: [] }); onNodeClick(new MouseEvent('click'), node); }} onMouseDown={() => onNodeDragStart?.(new MouseEvent('mousedown'), { id: node.id, position: { x: 80, y: 80 } })} onDoubleClick={() => onNodeDragStop(new MouseEvent('mouseup'), { id: node.id, position: { x: 500, y: 600 } })}>
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

describe('UmlEditorClient', { timeout: 15_000 }, () => {
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
    projectApiMock.get.mockReset();
    projectApiMock.saveDocument.mockReset();
    reactFlowLifecycle.mounts = 0;
    reactFlowLifecycle.unmounts = 0;
    resizeObserverCallbacks = [];
    socketIoMock.reset();
    clearAuthSession();
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
    clearAuthSession();
  });

  function createRelationshipWithDialog(kind: string, sourceId: string, targetId: string) {
    fireEvent.click(screen.getByText('Relation'));
    expect(screen.getByRole('dialog', { name: 'Crear relación' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Tipo de relación'), { target: { value: kind } });
    fireEvent.change(screen.getByLabelText('Origen'), { target: { value: sourceId } });
    fireEvent.change(screen.getByLabelText('Destino'), { target: { value: targetId } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));
  }

  it('renders the workspace shell, route-owned editor content and projected canvas', () => {
    resetEditorStoreForTests(createDemoProjectDocument());
    render(<UmlEditorClient allowDemoForTests />);

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

    const html = renderToString(<UmlEditorClient allowDemoForTests />);

    expect(html).toContain('CASE / UML / WORKBENCH');
    expect(html).toContain('Auto Layout');
    expect(html).not.toContain('aria-label="Menu"');
    expect(html).not.toContain('Props');
  });

  it('requires a project selection instead of loading the demo editor on bare /editor', () => {
    resetEditorStoreForTests(createDemoProjectDocument());
    render(<UmlEditorClient allowDemoForTests={false} />);

    expect(screen.getByText('Select a persisted project before opening the editor.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to projects' })).toHaveAttribute('href', '/');
    expect(screen.queryByTestId('uml-workspace')).not.toBeInTheDocument();
  });

  it('does not show the local demo badge for a persisted project session', () => {
    const project = createDemoProjectDocument();
    useEditorStore.getState().replaceProjectSession({ project: { ...project, id: '11111111-1111-4111-8111-111111111111' }, storageVersion: 0 });

    render(<UmlEditorClient allowDemoForTests />);

    expect(screen.queryByText('LOCAL DEMO')).not.toBeInTheDocument();
  });

  it('starts one active realtime transport and leaves Connecting when its handshake fails', async () => {
    const project = createDemoProjectDocument();
    project.id = '11111111-1111-4111-8111-111111111111';
    projectApiMock.get.mockResolvedValue({ project, storageVersion: 0 });
    setAuthSession({ accessToken: 'safe-test-token', user: { id: 'user-a', email: 'owner@example.com' } });

    render(<UmlEditorClient projectId={project.id} />);

    await waitFor(() => expect(socketIoMock.sockets).toHaveLength(1));
    const socket = socketIoMock.sockets[0]!;
    expect(socket.connect).toHaveBeenCalledTimes(1);
    expect(socket.emitted).toEqual([]);
    act(() => { for (const listener of socket.listeners.get('connect_error') ?? []) listener(new Error('secret transport detail')); });
    expect(useEditorStore.getState().collaborationState).toBe('error');
    expect(screen.getByTestId('collaboration-status')).toHaveTextContent('Collaboration connection failed. Shared mutations are blocked.');
    expect(screen.queryByText('secret transport detail')).not.toBeInTheDocument();
  });

  it('disposes an old editor generation before starting one replacement transport', async () => {
    const project = createDemoProjectDocument();
    project.id = '11111111-1111-4111-8111-811111111111';
    projectApiMock.get.mockResolvedValue({ project, storageVersion: 0 });
    setAuthSession({ accessToken: 'safe-test-token', user: { id: 'user-a', email: 'owner@example.com' } });

    const first = render(<UmlEditorClient projectId={project.id} />);

    await waitFor(() => expect(socketIoMock.sockets).toHaveLength(1));
    expect(socketIoMock.sockets[0]!.connect).toHaveBeenCalledTimes(1);
    first.unmount();
    expect(socketIoMock.sockets[0]!.disconnect).toHaveBeenCalledTimes(1);
    expect(socketIoMock.sockets[0]!.listeners.get('connect')?.size ?? 0).toBe(0);

    render(<UmlEditorClient projectId={project.id} />);
    await waitFor(() => expect(socketIoMock.sockets).toHaveLength(2));
    expect(socketIoMock.sockets[1]!.connect).toHaveBeenCalledTimes(1);
    expect(socketIoMock.sockets[1]!.listeners.get('connect')?.size).toBe(1);
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
      expect(screen.getByRole('option', { name: label })).toBeInTheDocument();
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

    createRelationshipWithDialog('generalization', 'class-priority-order', 'class-customer');
    expect(useEditorStore.getState().currentDocument.model.relationships.some((relationship) => relationship.kind === 'generalization' && relationship.target.classId === 'class-customer')).toBe(true);
  });

  it('creates named associations with optional UML presets and saves inspector changes through one history command', async () => {
    const project = createDemoProjectDocument();
    project.id = '11111111-1111-4111-8111-111111111111';
    useEditorStore.getState().replaceProjectSession({ project, storageVersion: 4 });
    render(<UmlEditorClient />);

    fireEvent.click(screen.getByText('Relation'));
    fireEvent.change(screen.getByLabelText('Nombre de relación'), { target: { value: 'assigned to' } });
    expect(screen.getByLabelText('Multiplicidad origen')).toHaveValue('');
    expect(screen.getByLabelText('Multiplicidad destino')).toHaveValue('');
    fireEvent.change(screen.getByLabelText('Multiplicidad origen'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Multiplicidad destino'), { target: { value: '0..*' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));

    const relationship = useEditorStore.getState().currentDocument.model.relationships.at(-1)!;
    expect(relationship).toMatchObject({ name: 'assigned to', source: { multiplicity: { lower: 1, upper: 1 } }, target: { multiplicity: { lower: 0, upper: '*' } } });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Crear relación' })).not.toBeInTheDocument());
    fireEvent.click(screen.getByTestId(`flow-edge-${relationship.id}`));
    const undoCount = useEditorStore.getState().undoCount;
    fireEvent.change(screen.getByLabelText('Nombre de relación'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Multiplicidad origen'), { target: { value: '0..1' } });
    fireEvent.change(screen.getByLabelText('Multiplicidad destino'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(useEditorStore.getState().undoCount).toBe(undoCount + 1);
    expect(useEditorStore.getState().saveState).toBe('dirty');
    expect(useEditorStore.getState().currentDocument.model.relationships.at(-1)).toMatchObject({ source: { multiplicity: { lower: 0, upper: 1 } }, target: { multiplicity: undefined } });
    expect(useEditorStore.getState().currentDocument.model.relationships.at(-1)?.name).toBeUndefined();
    projectApiMock.saveDocument.mockResolvedValue({ project: useEditorStore.getState().currentDocument, storageVersion: 5 });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(useEditorStore.getState()).toMatchObject({ storageVersion: 5, saveState: 'saved' }));
    expect(projectApiMock.saveDocument).toHaveBeenCalledWith(project.id, expect.objectContaining({
      baseStorageVersion: 4,
      document: expect.objectContaining({ model: expect.objectContaining({ relationships: expect.arrayContaining([expect.objectContaining({ id: relationship.id, name: undefined, source: expect.objectContaining({ multiplicity: { lower: 0, upper: 1 } }), target: expect.objectContaining({ multiplicity: undefined }) })]) }) }),
    }));
    fireEvent.click(screen.getByText('Undo'));
    expect(useEditorStore.getState().currentDocument.model.relationships.at(-1)).toMatchObject({ name: 'assigned to', source: { multiplicity: { lower: 1, upper: 1 } }, target: { multiplicity: { lower: 0, upper: '*' } } });
    expect(useEditorStore.getState().saveState).toBe('dirty');
    fireEvent.click(screen.getByText('Redo'));
    expect(useEditorStore.getState().saveState).toBe('idle');
  });

  it('does not assign multiplicities or show multiplicity controls for generalization', () => {
    resetEditorStoreForTests(createDemoProjectDocument());
    render(<UmlEditorClient />);

    fireEvent.click(screen.getByText('Relation'));
    fireEvent.change(screen.getByLabelText('Tipo de relación'), { target: { value: 'generalization' } });
    expect(screen.queryByLabelText('Multiplicidad origen')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));

    const relationship = useEditorStore.getState().currentDocument.model.relationships.at(-1)!;
    expect(relationship).toMatchObject({ kind: 'generalization' });
    expect(relationship.source.multiplicity).toBeUndefined();
    expect(relationship.target.multiplicity).toBeUndefined();
    fireEvent.click(screen.getByTestId(`flow-edge-${relationship.id}`));
    const inspector = screen.getByTestId('inspector-relationship-sections');
    expect(inspector).not.toHaveTextContent('Multiplicity');
    expect(within(inspector).getByLabelText('Nombre de relación')).toBeInTheDocument();
    expect(within(inspector).queryByLabelText('Multiplicidad origen')).not.toBeInTheDocument();
  });

  it.each(relationshipTools)('creates persisted $kind from the relation dialog with projection, history and manual save', async ({ kind, sourceId, targetId }) => {
    const project = createDemoProjectDocument();
    project.id = '11111111-1111-4111-8111-111111111111';
    useEditorStore.getState().replaceProjectSession({ project, storageVersion: 4 });
    render(<UmlEditorClient />);
    const beforeCount = useEditorStore.getState().currentDocument.model.relationships.length;

    createRelationshipWithDialog(kind, sourceId, targetId);

    let state = useEditorStore.getState();
    const relationships = state.currentDocument.model.relationships;
    const relationship = relationships.at(-1)!;
    expect(relationships).toHaveLength(beforeCount + 1);
    expect(relationship.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(relationship).toMatchObject({ kind, source: { classId: sourceId }, target: { classId: targetId } });
    expect(state.relationshipDraft).toBeNull();
    expect(state.activeTool).toBe('select');
    expect(state.saveState).toBe('dirty');
    expect(state.storageVersion).toBe(4);
    expect(screen.getByTestId(`flow-edge-${relationship.id}`)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId(`flow-node-${targetId}`));
    expect(useEditorStore.getState().currentDocument.model.relationships).toHaveLength(beforeCount + 1);
    expect(useEditorStore.getState().storageVersion).toBe(4);

    fireEvent.click(screen.getByText('Undo'));
    state = useEditorStore.getState();
    expect(state.currentDocument.model.relationships).toHaveLength(beforeCount);
    expect(state.saveState).toBe('idle');

    fireEvent.click(screen.getByText('Redo'));
    state = useEditorStore.getState();
    expect(state.currentDocument.model.relationships.at(-1)).toMatchObject({ id: relationship.id, kind, source: { classId: sourceId }, target: { classId: targetId } });
    expect(state.saveState).toBe('dirty');

    projectApiMock.saveDocument.mockResolvedValue({ project: state.currentDocument, storageVersion: 5 });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(useEditorStore.getState()).toMatchObject({ storageVersion: 5, saveState: 'saved' }));
    expect(projectApiMock.saveDocument).toHaveBeenCalledWith(project.id, expect.objectContaining({
      baseStorageVersion: 4,
      document: expect.objectContaining({
        model: expect.objectContaining({ relationships: expect.arrayContaining([expect.objectContaining({ id: relationship.id, kind, source: expect.objectContaining({ classId: sourceId }), target: expect.objectContaining({ classId: targetId }) })]) }),
      }),
    }));

    fireEvent.click(screen.getByText('Undo'));
    expect(useEditorStore.getState().saveState).toBe('dirty');
    fireEvent.click(screen.getByText('Redo'));
    expect(useEditorStore.getState().saveState).toBe('idle');
  });

  it('blocks self relationships in the dialog without mutating the document', () => {
    resetEditorStoreForTests(createDemoProjectDocument());
    render(<UmlEditorClient />);
    const before = useEditorStore.getState().currentDocument;

    createRelationshipWithDialog('aggregation', 'class-customer', 'class-customer');

    expect(useEditorStore.getState().currentDocument).toEqual(before);
    expect(useEditorStore.getState().relationshipDraft).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Crear relación' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear' })).toBeDisabled();
  });

  it('cancels the relation dialog without changing the persisted document or storage version', async () => {
    const project = createDemoProjectDocument();
    project.id = '11111111-1111-4111-8111-111111111111';
    useEditorStore.getState().replaceProjectSession({ project, storageVersion: 4 });
    render(<UmlEditorClient />);
    const beforeDocument = structuredClone(useEditorStore.getState().currentDocument);

    fireEvent.click(screen.getByText('Relation'));
    fireEvent.change(screen.getByLabelText('Tipo de relación'), { target: { value: 'composition' } });
    fireEvent.change(screen.getByLabelText('Origen'), { target: { value: 'class-order' } });
    fireEvent.change(screen.getByLabelText('Destino'), { target: { value: 'class-invoice' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Crear relación' })).not.toBeInTheDocument());
    expect(useEditorStore.getState().currentDocument).toEqual(beforeDocument);
    expect(useEditorStore.getState().storageVersion).toBe(4);
    expect(projectApiMock.saveDocument).not.toHaveBeenCalled();
    expect(useEditorStore.getState().relationshipDraft).toBeNull();
    expect(useEditorStore.getState().activeTool).toBe('select');
  });

  it('commits an intentional drag through exactly one MoveNode and keeps the semantic model unchanged', () => {
    resetEditorStoreForTests(createDemoProjectDocument());
    render(<UmlEditorClient />);
    const modelBefore = JSON.stringify(useEditorStore.getState().currentDocument.model);

    fireEvent.doubleClick(screen.getByTestId('flow-node-class-customer'));
    fireEvent.doubleClick(screen.getByTestId('flow-node-class-customer'));

    expect(useEditorStore.getState().currentDocument.layout.nodes.find((node) => node.elementId === 'class-customer')?.position).toEqual({ x: 500, y: 600 });
    expect(JSON.stringify(useEditorStore.getState().currentDocument.model)).toBe(modelBefore);
    expect(useEditorStore.getState().undoCount).toBe(1);
  });

  it('keeps drag start and frames presence-only, then submits one flow-space MoveNode without optimistic state', () => {
    resetEditorStoreForTests(createDemoProjectDocument());
    const submitted: unknown[] = [];
    const activity = vi.fn();
    const gate = new RealtimeCommandGate(
      () => ({ projectId: 'project-a', sessionId: 'session-a', realtimeVersion: 2, revision: 1, storageVersion: 4, documentDigest: 'digest' }),
      { submitRealtimeCommand: (envelope) => { submitted.push(envelope); return new Promise(() => undefined); } },
    );
    useEditorStore.getState().setRealtimeCommandGate(gate);
    const before = useEditorStore.getState();
    const flow = projectDocumentToFlow(before.currentDocument, before.selection, before.diagnostics);
    render(<UmlCanvas flow={flow} onLocalActivity={activity} />);
    const node = screen.getByTestId('flow-node-class-customer');

    fireEvent.mouseDown(node);
    fireEvent.mouseMove(node);

    expect(activity).toHaveBeenCalledWith('dragging');
    expect(submitted).toEqual([]);
    expect(useEditorStore.getState().currentDocument).toBe(before.currentDocument);
    expect(useEditorStore.getState().history).toBe(before.history);

    fireEvent.doubleClick(node);
    fireEvent.doubleClick(node);

    expect(activity).toHaveBeenLastCalledWith(null);
    expect(submitted).toHaveLength(1);
    expect(submitted[0]).toMatchObject({ command: { type: 'MoveNode', elementId: 'class-customer', position: { x: 500, y: 600 } } });
    expect(useEditorStore.getState().currentDocument).toBe(before.currentDocument);
    expect(useEditorStore.getState().history).toBe(before.history);
    expect(useEditorStore.getState().currentDocument.layout.nodes.find((entry) => entry.elementId === 'class-customer')?.position).toEqual({ x: 80, y: 80 });
  });

  it('submits one connected ApplyLayout without MoveNode commands or optimistic layout mutation', async () => {
    resetEditorStoreForTests(createDemoProjectDocument());
    const submitted: unknown[] = [];
    const gate = new RealtimeCommandGate(
      () => ({ projectId: 'project-a', sessionId: 'session-a', realtimeVersion: 2, revision: 1, storageVersion: 4, documentDigest: 'digest' }),
      { submitRealtimeCommand: (envelope) => { submitted.push(envelope); return new Promise(() => undefined); } },
    );
    useEditorStore.getState().setRealtimeCommandGate(gate);
    const before = useEditorStore.getState();

    await act(async () => { await useEditorStore.getState().applyAutoLayout(); });

    expect(submitted).toHaveLength(1);
    expect(submitted[0]).toMatchObject({ command: { type: 'ApplyLayout' } });
    expect((submitted[0] as { command: { type: string } }).command.type).not.toBe('MoveNode');
    expect(useEditorStore.getState().currentDocument).toBe(before.currentDocument);
    expect(useEditorStore.getState().history).toBe(before.history);
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

  it('uses keyboard history outside realtime and disables it with the realtime controls', () => {
    resetEditorStoreForTests(createDemoProjectDocument());
    render(<UmlEditorClient />);

    fireEvent.click(screen.getByText('Clase'));
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(useEditorStore.getState().redoCount).toBe(1);

    const gate = new RealtimeCommandGate(
      () => ({ projectId: 'project-a', sessionId: 'session-a', realtimeVersion: 0, revision: 1, storageVersion: 0, documentDigest: 'digest' }),
      { submitRealtimeCommand: async () => ({ ok: true, status: 'APPLIED', data: {} } as never) },
    );
    act(() => useEditorStore.getState().setRealtimeCommandGate(gate));

    expect(screen.getByText('Undo')).toBeDisabled();
    expect(screen.getByText('Redo')).toBeDisabled();
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true });
    expect(useEditorStore.getState().redoCount).toBe(1);
  });

  it('uses the central disconnected lifecycle to block mutations and replace Save with accessible status', async () => {
    resetEditorStoreForTests(createDemoProjectDocument());
    render(<UmlEditorClient />);
    const beforeDocument = useEditorStore.getState().currentDocument;
    act(() => useEditorStore.getState().setCollaborationLifecycle('disconnected'));

    expect(screen.getByRole('button', { name: 'Collaboration persistence: Disconnected' })).toBeDisabled();
    expect(screen.getByTestId('collaboration-status')).toHaveTextContent('Disconnected. Shared mutations are blocked.');
    expect(screen.getByText('Clase')).toBeDisabled();
    expect(screen.getByText('Relation')).toBeDisabled();
    expect(screen.getByText('Auto Layout')).toBeDisabled();
    expect(screen.getByText('Undo')).toBeDisabled();
    expect(screen.getByText('Redo')).toBeDisabled();

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    fireEvent.doubleClick(screen.getByTestId('flow-node-class-customer'));
    await waitFor(() => expect(useEditorStore.getState().currentDocument).toBe(beforeDocument));
    expect(projectApiMock.saveDocument).not.toHaveBeenCalled();
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
      expect(screen.getByTestId('editor-canvas-region')).toHaveStyle({ height: '100%' });
      expect(screen.getByTestId('uml-canvas')).toHaveStyle({ position: 'absolute', height: '100%', overflow: 'hidden' });
      expect(screen.getByTestId('react-flow-host')).toHaveStyle({ position: 'absolute', inset: '0', height: '100%' });
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

  it('handles zero, valid and repeated observer sizes without mutating the persisted session', async () => {
    const project = createDemoProjectDocument();
    project.id = '11111111-1111-4111-8111-111111111111';
    useEditorStore.getState().replaceProjectSession({ project, storageVersion: 4 });
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
        this.callback([{ target, contentRect: { width: 0, height: 0 } as DOMRectReadOnly } as ResizeObserverEntry], this);
      }

      disconnect() {}
      unobserve() {}
    };
    const beforeDocument = useEditorStore.getState().currentDocument;
    const beforeLayout = structuredClone(beforeDocument.layout);
    const beforeSaveState = useEditorStore.getState().saveState;

    render(<UmlEditorClient />);
    expect(screen.queryByTestId('react-flow')).not.toBeInTheDocument();
    let storeUpdates = 0;
    const unsubscribe = useEditorStore.subscribe(() => {
      storeUpdates += 1;
    });
    const host = screen.getByTestId('react-flow-host');
    Object.defineProperties(host, {
      clientWidth: { configurable: true, value: 720 },
      clientHeight: { configurable: true, value: 480 },
      offsetWidth: { configurable: true, value: 720 },
      offsetHeight: { configurable: true, value: 480 },
    });

    act(() => {
      const callback = resizeObserverCallbacks.at(-1)!;
      const entry = [{ target: host, contentRect: { width: 720, height: 480 } as DOMRectReadOnly } as unknown as ResizeObserverEntry];
      callback(entry, {} as ResizeObserver);
      callback(entry, {} as ResizeObserver);
    });

    await waitFor(() => expect(screen.getByTestId('react-flow')).toBeInTheDocument());
    await waitFor(() => expect(fitViewMock).toHaveBeenCalledTimes(1));
    unsubscribe();
    expect(reactFlowLifecycle.mounts).toBe(1);
    expect(storeUpdates).toBe(0);
    expect(useEditorStore.getState().currentDocument).toBe(beforeDocument);
    expect(useEditorStore.getState().currentDocument.layout).toEqual(beforeLayout);
    expect(useEditorStore.getState().saveState).toBe(beforeSaveState);
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

  it('does not refit or emit feedback when an authoritative layout installation changes projected nodes', async () => {
    const project = createDemoProjectDocument();
    project.id = '11111111-1111-4111-8111-111111111111';
    useEditorStore.getState().replaceProjectSession({ project, storageVersion: 4 });
    render(<UmlEditorClient />);
    await waitFor(() => expect(fitViewMock).toHaveBeenCalledTimes(1));
    fitViewMock.mockClear();
    const authoritative = structuredClone(project);
    authoritative.layout.nodes[0]!.position = { x: 900, y: 800 };
    authoritative.revision += 1;
    let storeUpdates = 0;
    const unsubscribe = useEditorStore.subscribe(() => { storeUpdates += 1; });

    act(() => useEditorStore.getState().installAuthoritativeDocument({ project: authoritative, storageVersion: 5 }));
    await act(async () => { await new Promise((resolve) => window.requestAnimationFrame(resolve)); });

    unsubscribe();
    expect(storeUpdates).toBe(1);
    expect(fitViewMock).not.toHaveBeenCalled();
    expect(useEditorStore.getState().currentDocument.layout.nodes[0]?.position).toEqual({ x: 900, y: 800 });
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

  it('keeps the user viewport and DiagramLayout unchanged when the canvas receives a real resize', async () => {
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
    await act(async () => { await new Promise((resolve) => window.requestAnimationFrame(resolve)); });

    expect(useEditorStore.getState().currentDocument.layout).toEqual(beforeLayout);
    expect(fitViewMock).not.toHaveBeenCalled();
  });

  it('keeps the domain snapshot unchanged when React Flow reports dimensions and selection', async () => {
    resetEditorStoreForTests(createDemoProjectDocument());
    render(<UmlEditorClient />);
    await waitFor(() => expect(screen.getByTestId('react-flow')).toBeInTheDocument());
    const beforeDocument = useEditorStore.getState().currentDocument;
    const beforeModel = structuredClone(beforeDocument.model);
    const beforeLayout = structuredClone(beforeDocument.layout);
    const host = screen.getByTestId('react-flow-host');

    act(() => {
      Object.defineProperties(host, {
        clientWidth: { configurable: true, value: 760 },
        clientHeight: { configurable: true, value: 540 },
        offsetWidth: { configurable: true, value: 760 },
        offsetHeight: { configurable: true, value: 540 },
      });
      resizeObserverCallbacks.at(-1)?.([{ contentRect: { width: 760, height: 540 } as DOMRectReadOnly } as ResizeObserverEntry], {} as ResizeObserver);
      fireEvent.click(screen.getByTestId('flow-node-class-customer'));
    });

    await waitFor(() => expect(useEditorStore.getState().selection).toEqual({ type: 'class', id: 'class-customer' }));
    expect(useEditorStore.getState().currentDocument).toBe(beforeDocument);
    expect(useEditorStore.getState().currentDocument.model).toEqual(beforeModel);
    expect(useEditorStore.getState().currentDocument.layout).toEqual(beforeLayout);
    expect(useEditorStore.getState().undoCount).toBe(0);
  });

  it('creates a relationship from the dialog without activating the React Flow click tool', () => {
    resetEditorStoreForTests(createDemoProjectDocument());
    render(<UmlEditorClient />);

    createRelationshipWithDialog('association', 'class-customer', 'class-order');

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
