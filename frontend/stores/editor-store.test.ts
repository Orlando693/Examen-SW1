import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetEditorStoreForTests, useEditorStore } from './editor-store';
import { createDemoProjectDocument } from '../lib/editor/demo/demo-document';
import { projectDocumentToFlow } from '../lib/editor/projection/project-document-to-flow';
import { RealtimeCommandGate } from '../lib/collaboration/realtime-command-gate';
import { createAssistantModelContext, createPreview } from '@examen-sw1/assistant-core';

const createAutoLayoutCommandMock = vi.hoisted(() => vi.fn());
const projectApiMock = vi.hoisted(() => ({
  get: vi.fn(),
  saveDocument: vi.fn(),
}));

vi.mock('../lib/editor/layout/auto-layout', () => ({
  createAutoLayoutCommand: createAutoLayoutCommandMock,
}));

vi.mock('../lib/projects/project-api', () => ({ projectApi: projectApiMock }));

function projectResource(id: string, storageVersion = 0) {
  const project = createDemoProjectDocument();
  project.id = id;
  project.metadata.name = `Project ${id}`;
  return { project, storageVersion };
}

describe('editor store', () => {
  beforeEach(() => {
    createAutoLayoutCommandMock.mockResolvedValue({
      type: 'ApplyLayout',
      updates: [
        { elementId: 'class-customer', position: { x: 10, y: 20 } },
        { elementId: 'class-order', position: { x: 300, y: 20 } },
      ],
    });
    projectApiMock.get.mockReset();
    projectApiMock.saveDocument.mockReset();
  });

  it('does not notify subscribers for redundant selection updates', () => {
    resetEditorStoreForTests(createDemoProjectDocument());
    let updates = 0;
    const unsubscribe = useEditorStore.subscribe(() => {
      updates += 1;
    });

    act(() => {
      useEditorStore.getState().setSelection(null);
      useEditorStore.getState().setSelection(null);
    });

    unsubscribe();
    expect(updates).toBe(0);
  });

  it('keeps UmlHistory and currentDocument synchronized after execute, undo and redo', () => {
    resetEditorStoreForTests(createDemoProjectDocument());

    act(() => {
      useEditorStore.getState().renameClass('class-customer', 'Client');
    });
    expect(useEditorStore.getState().currentDocument).toEqual(useEditorStore.getState().history.document);
    expect(projectDocumentToFlow(useEditorStore.getState().currentDocument).nodes.find((node) => node.id === 'class-customer')?.data.name).toBe('Client');

    act(() => useEditorStore.getState().undo());
    expect(useEditorStore.getState().currentDocument).toEqual(useEditorStore.getState().history.document);
    expect(useEditorStore.getState().currentDocument.model.classes.find((umlClass) => umlClass.id === 'class-customer')?.name).toBe('Customer');

    act(() => useEditorStore.getState().redo());
    expect(useEditorStore.getState().currentDocument).toEqual(useEditorStore.getState().history.document);
    expect(useEditorStore.getState().currentDocument.model.classes.find((umlClass) => umlClass.id === 'class-customer')?.name).toBe('Client');
  });

  it('moves nodes through MoveNode and changes only DiagramLayout', () => {
    resetEditorStoreForTests(createDemoProjectDocument());
    const modelBefore = JSON.stringify(useEditorStore.getState().currentDocument.model);

    act(() => {
      useEditorStore.getState().moveNode('class-customer', { x: 222, y: 333 });
    });

    expect(useEditorStore.getState().currentDocument.layout.nodes.find((node) => node.elementId === 'class-customer')?.position).toEqual({ x: 222, y: 333 });
    expect(JSON.stringify(useEditorStore.getState().currentDocument.model)).toBe(modelBefore);
  });

  it('applies Auto Layout as one history entry and restores all positions on undo and redo', async () => {
    resetEditorStoreForTests(createDemoProjectDocument());
    const before = useEditorStore.getState().currentDocument.layout.nodes.map((node) => [node.elementId, node.position]);

    await act(async () => {
      await useEditorStore.getState().applyAutoLayout();
    });

    expect(useEditorStore.getState().undoCount).toBe(1);
    expect(useEditorStore.getState().currentDocument.layout.nodes.filter((node) => node.position.x === 10 || node.position.x === 300)).toHaveLength(2);

    act(() => useEditorStore.getState().undo());
    expect(useEditorStore.getState().currentDocument.layout.nodes.map((node) => [node.elementId, node.position])).toEqual(before);

    act(() => useEditorStore.getState().redo());
    expect(useEditorStore.getState().currentDocument.layout.nodes.find((node) => node.elementId === 'class-customer')?.position).toEqual({ x: 10, y: 20 });
    expect(useEditorStore.getState().currentDocument.layout.nodes.find((node) => node.elementId === 'class-order')?.position).toEqual({ x: 300, y: 20 });
  });

  it('supports class, attribute, enum, relationship and multiplicity command actions', () => {
    resetEditorStoreForTests(createDemoProjectDocument());

    act(() => {
      useEditorStore.getState().deleteClass('class-invoice');
    });
    expect(useEditorStore.getState().currentDocument.model.classes.some((umlClass) => umlClass.id === 'class-invoice')).toBe(false);

    act(() => {
      useEditorStore.getState().removeAttribute('class-customer', 'attr-customer-email');
    });
    expect(useEditorStore.getState().currentDocument.model.classes.find((umlClass) => umlClass.id === 'class-customer')?.attributes.some((attribute) => attribute.id === 'attr-customer-email')).toBe(false);

    act(() => {
      useEditorStore.getState().renameEnumeration('enum-order-status', 'PaymentStatus');
      useEditorStore.getState().updateEnumerationLiteral('enum-order-status', 'literal-paid', 'SETTLED');
      useEditorStore.getState().removeEnumerationLiteral('enum-order-status', 'literal-draft');
    });
    const enumeration = useEditorStore.getState().currentDocument.model.enumerations.find((candidate) => candidate.id === 'enum-order-status');
    expect(enumeration?.name).toBe('PaymentStatus');
    expect(enumeration?.literals.map((literal) => literal.name)).toEqual(['SETTLED']);

    act(() => {
      useEditorStore.getState().startRelationship('aggregation', 'class-customer');
      useEditorStore.getState().completeRelationship('class-order');
      useEditorStore.getState().startRelationship('composition', 'class-order');
      useEditorStore.getState().completeRelationship('class-customer');
    });
    expect(useEditorStore.getState().currentDocument.model.relationships.some((relationship) => relationship.kind === 'aggregation')).toBe(true);
    expect(useEditorStore.getState().currentDocument.model.relationships.some((relationship) => relationship.kind === 'composition')).toBe(true);

    act(() => {
      useEditorStore.getState().updateMultiplicity('rel-customer-orders', 'target', { lower: 1, upper: 9 });
    });
    expect(useEditorStore.getState().currentDocument.model.relationships.find((relationship) => relationship.id === 'rel-customer-orders')?.target.multiplicity).toEqual({ lower: 1, upper: 9 });

    act(() => {
      useEditorStore.getState().deleteRelationship('rel-customer-orders');
    });
    expect(useEditorStore.getState().currentDocument.model.relationships.some((relationship) => relationship.id === 'rel-customer-orders')).toBe(false);
  });

  it('rejects self relationships without executing a UML command', () => {
    resetEditorStoreForTests(createDemoProjectDocument());
    const before = useEditorStore.getState().currentDocument;

    act(() => {
      useEditorStore.getState().startRelationship('aggregation', 'class-customer');
      useEditorStore.getState().completeRelationship('class-customer');
    });

    expect(useEditorStore.getState().currentDocument).toEqual(before);
    expect(useEditorStore.getState().relationshipDraft).toBeNull();
    expect(useEditorStore.getState().lastCommandError).toMatch(/si misma/);
  });

  it('updates attribute name and type through UpdateAttribute and keeps undo/redo synchronized', () => {
    resetEditorStoreForTests(createDemoProjectDocument());

    act(() => {
      useEditorStore.getState().addAttribute('class-customer');
    });
    const attribute = useEditorStore.getState().currentDocument.model.classes.find((umlClass) => umlClass.id === 'class-customer')?.attributes.at(-1);
    expect(attribute?.type).toEqual({ kind: 'primitive', name: 'string' });

    act(() => {
      useEditorStore.getState().updateAttribute('class-customer', attribute?.id ?? '', 'edad', { kind: 'primitive', name: 'number' });
    });
    expect(useEditorStore.getState().currentDocument.model.classes.find((umlClass) => umlClass.id === 'class-customer')?.attributes.at(-1)).toMatchObject({ name: 'edad', type: { kind: 'primitive', name: 'number' } });
    expect(useEditorStore.getState().currentDocument).toEqual(useEditorStore.getState().history.document);

    act(() => useEditorStore.getState().undo());
    expect(useEditorStore.getState().currentDocument.model.classes.find((umlClass) => umlClass.id === 'class-customer')?.attributes.at(-1)).toMatchObject({ name: 'newAttribute', type: { kind: 'primitive', name: 'string' } });

    act(() => useEditorStore.getState().redo());
    expect(useEditorStore.getState().currentDocument.model.classes.find((umlClass) => umlClass.id === 'class-customer')?.attributes.at(-1)).toMatchObject({ name: 'edad', type: { kind: 'primitive', name: 'number' } });
  });

  it('shows command validation errors without partially updating state', () => {
    resetEditorStoreForTests(createDemoProjectDocument());
    const before = useEditorStore.getState().currentDocument;

    act(() => {
      useEditorStore.getState().renameClass('class-customer', '');
    });

    expect(useEditorStore.getState().currentDocument).toEqual(before);
    expect(useEditorStore.getState().lastCommandError).toBe('Command produced validation errors.');
    expect(useEditorStore.getState().diagnostics.some((diagnostic) => diagnostic.severity === 'ERROR')).toBe(true);
  });

  it('clears redo after a new operation following undo', () => {
    resetEditorStoreForTests(createDemoProjectDocument());

    act(() => {
      useEditorStore.getState().renameClass('class-customer', 'Client');
      useEditorStore.getState().undo();
    });
    expect(useEditorStore.getState().redoCount).toBe(1);

    act(() => {
      useEditorStore.getState().renameClass('class-order', 'PurchaseOrder');
    });
    expect(useEditorStore.getState().redoCount).toBe(0);
  });

  it('replaces a project with a fresh clean history and durable UUID command IDs', () => {
    resetEditorStoreForTests(createDemoProjectDocument());
    act(() => useEditorStore.getState().replaceProjectSession(projectResource('project-a', 3)));
    act(() => useEditorStore.getState().renameClass('class-customer', 'Local change'));
    const previousHistory = useEditorStore.getState().history;

    act(() => useEditorStore.getState().replaceProjectSession(projectResource('project-b', 7)));
    act(() => {
      useEditorStore.getState().createClass();
      const classId = useEditorStore.getState().selection?.id ?? '';
      useEditorStore.getState().addAttribute(classId);
      useEditorStore.getState().createEnumeration();
      const enumerationId = useEditorStore.getState().selection?.id ?? '';
      useEditorStore.getState().addEnumerationLiteral(enumerationId);
      useEditorStore.getState().startRelationship('association', 'class-customer');
      useEditorStore.getState().completeRelationship(classId);
    });

    const state = useEditorStore.getState();
    const createdClass = state.currentDocument.model.classes.at(-1)!;
    const createdEnumeration = state.currentDocument.model.enumerations.at(-1)!;
    const createdRelationship = state.currentDocument.model.relationships.at(-1)!;
    expect(state.history).not.toBe(previousHistory);
    expect(state.projectId).toBe('project-b');
    expect(state.storageVersion).toBe(7);
    expect(state.undoCount).toBe(5);
    expect(createdClass.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(createdClass.attributes.at(-1)?.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(createdEnumeration.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(createdEnumeration.literals.at(-1)?.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(createdRelationship.id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('installs an authoritative resource as one store update after command ingestion', () => {
    resetEditorStoreForTests(createDemoProjectDocument());
    const resource = projectResource('project-a', 8);
    resource.project.revision = 9;
    resource.project.model.classes[0]!.name = 'Authoritative customer';
    let updates = 0;
    const unsubscribe = useEditorStore.subscribe(() => { updates += 1; });

    act(() => useEditorStore.getState().installAuthoritativeDocument(resource));

    unsubscribe();
    expect(updates).toBe(1);
    expect(useEditorStore.getState()).toMatchObject({ projectId: 'project-a', storageVersion: 8, currentDocument: { revision: 9 }, saveState: 'saved' });
    expect(useEditorStore.getState().currentDocument.model.classes[0]?.name).toBe('Authoritative customer');
  });

  it('never echoes an authoritative document installation through the realtime command gate', () => {
    resetEditorStoreForTests(createDemoProjectDocument());
    const submitted: unknown[] = [];
    const gate = new RealtimeCommandGate(
      () => ({ projectId: 'project-a', sessionId: 'session-a', realtimeVersion: 0, revision: 0, storageVersion: 0, documentDigest: 'digest' }),
      { submitRealtimeCommand: (envelope) => { submitted.push(envelope); return new Promise(() => undefined); } },
    );
    useEditorStore.getState().setRealtimeCommandGate(gate);
    const resource = projectResource('project-a', 1);
    resource.project.model.classes[0]!.name = 'Remote change';

    act(() => useEditorStore.getState().installAuthoritativeDocument(resource));

    expect(useEditorStore.getState().currentDocument.model.classes[0]?.name).toBe('Remote change');
    expect(submitted).toEqual([]);
  });

  it('rebases empty history for every authoritative installation and collaboration exit', () => {
    resetEditorStoreForTests(createDemoProjectDocument());
    act(() => useEditorStore.getState().renameClass('class-customer', 'Pre-collaboration'));
    const preCollaborationHistory = useEditorStore.getState().history;

    let previousHistory = preCollaborationHistory;
    for (const name of ['Join', 'Own applied', 'Remote applied', 'Resync']) {
      const resource = projectResource('project-a');
      resource.project.model.classes[0]!.name = name;
      act(() => useEditorStore.getState().installAuthoritativeDocument(resource));
      expect(useEditorStore.getState().history).not.toBe(previousHistory);
      expect(useEditorStore.getState()).toMatchObject({ undoCount: 0, redoCount: 0 });
      expect(useEditorStore.getState().currentDocument.model.classes[0]?.name).toBe(name);
      act(() => useEditorStore.getState().undo());
      expect(useEditorStore.getState().currentDocument.model.classes[0]?.name).toBe(name);
      previousHistory = useEditorStore.getState().history;
    }

    act(() => useEditorStore.getState().rebaseHistoryToCurrentDocument());
    expect(useEditorStore.getState().history).not.toBe(previousHistory);
    expect(useEditorStore.getState()).toMatchObject({ undoCount: 0, redoCount: 0 });
  });

  it('derives dirty state from the saved snapshot and becomes clean after undo', () => {
    resetEditorStoreForTests(createDemoProjectDocument());
    act(() => useEditorStore.getState().replaceProjectSession(projectResource('project-a')));

    act(() => useEditorStore.getState().renameClass('class-customer', 'Changed'));
    expect(useEditorStore.getState().saveState).toBe('dirty');

    act(() => useEditorStore.getState().undo());
    expect(useEditorStore.getState().saveState).toBe('idle');
  });

  it('preserves local history across save success, failure, conflict, and confirmed reload', async () => {
    resetEditorStoreForTests(createDemoProjectDocument());
    act(() => useEditorStore.getState().replaceProjectSession(projectResource('project-a', 2)));
    act(() => useEditorStore.getState().renameClass('class-customer', 'Changed'));
    const history = useEditorStore.getState().history;
    const document = useEditorStore.getState().currentDocument;
    projectApiMock.saveDocument.mockResolvedValue({ project: document, storageVersion: 3 });

    await act(async () => useEditorStore.getState().save());
    expect(useEditorStore.getState()).toMatchObject({ storageVersion: 3, saveState: 'saved' });
    expect(useEditorStore.getState().history).toBe(history);
    expect(useEditorStore.getState().undoCount).toBe(1);

    act(() => useEditorStore.getState().renameClass('class-order', 'Purchase'));
    const unsavedDocument = useEditorStore.getState().currentDocument;
    projectApiMock.saveDocument.mockRejectedValue({ code: 'NETWORK_ERROR', message: 'Offline' });
    await act(async () => useEditorStore.getState().save());
    expect(useEditorStore.getState()).toMatchObject({ saveState: 'error', storageVersion: 3, currentDocument: unsavedDocument });

    projectApiMock.saveDocument.mockRejectedValue({ code: 'PROJECT_REVISION_CONFLICT', message: 'Stale' });
    await act(async () => useEditorStore.getState().save());
    expect(useEditorStore.getState()).toMatchObject({ saveState: 'conflict', storageVersion: 3, currentDocument: unsavedDocument });

    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    projectApiMock.get.mockResolvedValue(projectResource('project-a', 9));
    await act(async () => useEditorStore.getState().reloadProject());
    expect(confirm).toHaveBeenCalled();
    expect(useEditorStore.getState()).toMatchObject({ projectId: 'project-a', storageVersion: 9, saveState: 'idle' });
    expect(useEditorStore.getState().history).not.toBe(history);
    confirm.mockRestore();
  });

  it('ignores an auto-layout result that resolves after a project switch', async () => {
    resetEditorStoreForTests(createDemoProjectDocument());
    act(() => useEditorStore.getState().replaceProjectSession(projectResource('project-a')));
    let resolveLayout: (command: { type: 'ApplyLayout'; updates: Array<{ elementId: string; position: { x: number; y: number } }> }) => void;
    createAutoLayoutCommandMock.mockImplementationOnce(() => new Promise((resolve) => { resolveLayout = resolve; }));

    const pending = useEditorStore.getState().applyAutoLayout();
    act(() => useEditorStore.getState().replaceProjectSession(projectResource('project-b')));
    resolveLayout!({ type: 'ApplyLayout', updates: [{ elementId: 'class-customer', position: { x: 900, y: 900 } }] });
    await expect(pending).resolves.toMatchObject({ ok: false, reason: 'INVALID_COMMAND' });
    expect(useEditorStore.getState().projectId).toBe('project-b');
    expect(useEditorStore.getState().currentDocument.layout.nodes.find((node) => node.elementId === 'class-customer')?.position).toEqual({ x: 80, y: 80 });
  });

  it.each([
    ['CreateClass', () => useEditorStore.getState().createClass()],
    ['RenameClass', () => useEditorStore.getState().renameClass('class-customer', 'Client')],
    ['DeleteClass', () => useEditorStore.getState().deleteClass('class-invoice')],
    ['AddAttribute', () => useEditorStore.getState().addAttribute('class-customer')],
    ['UpdateAttribute', () => useEditorStore.getState().updateAttribute('class-customer', 'attr-customer-email', 'email')],
    ['RemoveAttribute', () => useEditorStore.getState().removeAttribute('class-customer', 'attr-customer-email')],
    ['CreateEnumeration', () => useEditorStore.getState().createEnumeration()],
    ['RenameEnumeration', () => useEditorStore.getState().renameEnumeration('enum-order-status', 'Status')],
    ['DeleteEnumeration', () => useEditorStore.getState().deleteEnumeration('enum-order-status')],
    ['AddEnumerationLiteral', () => useEditorStore.getState().addEnumerationLiteral('enum-order-status')],
    ['UpdateEnumerationLiteral', () => useEditorStore.getState().updateEnumerationLiteral('enum-order-status', 'literal-paid', 'PAID')],
    ['RemoveEnumerationLiteral', () => useEditorStore.getState().removeEnumerationLiteral('enum-order-status', 'literal-paid')],
    ['CreateAssociation', () => { useEditorStore.getState().startRelationship('association', 'class-customer'); return useEditorStore.getState().completeRelationship('class-order'); }],
    ['CreateGeneralization', () => useEditorStore.getState().createRelationship('generalization', 'class-customer', 'class-order')],
    ['DeleteRelationship', () => useEditorStore.getState().deleteRelationship('rel-customer-orders')],
    ['UpdateMultiplicity', () => useEditorStore.getState().updateMultiplicity('rel-customer-orders', 'target', { lower: 1, upper: 1 })],
    ['UpdateRelationship', () => useEditorStore.getState().updateRelationship('rel-customer-orders', { name: 'orders' })],
    ['MoveNode', () => useEditorStore.getState().moveNode('class-customer', { x: 400, y: 500 })],
    ['ApplyLayout', () => useEditorStore.getState().applyAutoLayout()],
  ])('routes %s through the realtime gate without optimistic canonical state', async (expectedType, invoke) => {
    resetEditorStoreForTests(createDemoProjectDocument());
    const submitted: unknown[] = [];
    const gate = new RealtimeCommandGate(
      () => ({ projectId: 'project-a', sessionId: 'session-a', realtimeVersion: 2, revision: 1, storageVersion: 4, documentDigest: 'digest' }),
      { submitRealtimeCommand: (envelope) => { submitted.push(envelope); return new Promise(() => undefined); } },
      useEditorStore.getState().setRealtimeCommandPending,
      useEditorStore.getState().setRealtimeCommandError,
    );
    useEditorStore.getState().setRealtimeCommandGate(gate);
    const before = useEditorStore.getState();
    const document = before.currentDocument;
    const history = before.history;
    const storageVersion = before.storageVersion;
    const savedPersistentSnapshot = before.savedPersistentSnapshot;

    await act(async () => { await invoke(); });

    const after = useEditorStore.getState();
    expect(submitted).toHaveLength(1);
    expect((submitted[0] as { command: { type: string } }).command.type).toBe(expectedType);
    expect(after.currentDocument).toBe(document);
    expect(after.history).toBe(history);
    expect(after.currentDocument.revision).toBe(document.revision);
    expect(after.storageVersion).toBe(storageVersion);
    expect(after.savedPersistentSnapshot).toBe(savedPersistentSnapshot);
    expect(after.undoCount).toBe(0);
    expect(after.redoCount).toBe(0);
    expect(after.realtimeCommandPending).toBe(true);
  });

  it('blocks undo, redo, and HTTP Save while realtime command authority is active', async () => {
    resetEditorStoreForTests(createDemoProjectDocument());
    act(() => useEditorStore.getState().renameClass('class-customer', 'Local change'));
    const gate = new RealtimeCommandGate(
      () => ({ projectId: 'project-a', sessionId: 'session-a', realtimeVersion: 0, revision: 1, storageVersion: 0, documentDigest: 'digest' }),
      { submitRealtimeCommand: async () => ({ ok: true, status: 'APPLIED', data: {} } as never) },
    );
    useEditorStore.getState().setRealtimeCommandGate(gate);
    const document = useEditorStore.getState().currentDocument;

    act(() => { useEditorStore.getState().undo(); useEditorStore.getState().redo(); });
    await useEditorStore.getState().save();

    expect(useEditorStore.getState().currentDocument).toBe(document);
    expect(projectApiMock.saveDocument).not.toHaveBeenCalled();
  });

  it('keeps an assistant preview immutable until explicit apply and executes it through editor history', () => {
    resetEditorStoreForTests(createDemoProjectDocument());
    const before = useEditorStore.getState().currentDocument;
    const context = createAssistantModelContext(before);
    const preview = createPreview('Create InvoiceLine', { version: 1, operation: 'create_class', name: 'InvoiceLine' }, context);
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;

    expect(useEditorStore.getState().currentDocument).toBe(before);
    expect(useEditorStore.getState().currentDocument.model.classes.some((item) => item.name === 'InvoiceLine')).toBe(false);

    act(() => expect(useEditorStore.getState().applyAssistantPreview(preview.preview, false)).toMatchObject({ ok: true }));
    expect(useEditorStore.getState().currentDocument.model.classes.some((item) => item.name === 'InvoiceLine')).toBe(true);
    expect(useEditorStore.getState().history.document).toStrictEqual(useEditorStore.getState().currentDocument);
  });

  it('rejects stale and unconfirmed destructive assistant previews without mutation', () => {
    resetEditorStoreForTests(createDemoProjectDocument());
    const before = useEditorStore.getState().currentDocument;
    const deletion = createPreview('Delete invoice', { version: 1, operation: 'delete_class', class: { id: 'class-invoice' } }, createAssistantModelContext(before));
    expect(deletion.ok).toBe(true);
    if (!deletion.ok) return;

    const unconfirmed = useEditorStore.getState().applyAssistantPreview(deletion.preview, false);
    expect(unconfirmed).toMatchObject({ ok: false, diagnostics: [{ code: 'CONFIRMATION_REQUIRED' }] });
    expect(useEditorStore.getState().currentDocument).toBe(before);

    act(() => useEditorStore.getState().renameClass('class-customer', 'Changed'));
    const stale = useEditorStore.getState().applyAssistantPreview(deletion.preview, true);
    expect(stale).toMatchObject({ ok: false, diagnostics: [{ code: 'STALE_PREVIEW' }] });
    expect(useEditorStore.getState().currentDocument.model.classes.some((item) => item.id === 'class-invoice')).toBe(true);
  });

  it.each([
    ['CreateClass', () => useEditorStore.getState().createClass()],
    ['RenameClass', () => useEditorStore.getState().renameClass('class-customer', 'Client')],
    ['AddAttribute', () => useEditorStore.getState().addAttribute('class-customer')],
    ['CreateEnumeration', () => useEditorStore.getState().createEnumeration()],
    ['CreateAssociation', () => useEditorStore.getState().createRelationship('association', 'class-customer', 'class-order')],
    ['UpdateRelationship', () => useEditorStore.getState().updateRelationship('rel-customer-orders', { name: 'orders' })],
    ['MoveNode', () => useEditorStore.getState().moveNode('class-customer', { x: 400, y: 500 })],
    ['ApplyLayout', () => useEditorStore.getState().applyAutoLayout()],
  ])('blocks %s without an offline mutation queue while collaboration is disconnected', async (_command, invoke) => {
    resetEditorStoreForTests(createDemoProjectDocument());
    const before = useEditorStore.getState();
    act(() => useEditorStore.getState().setCollaborationLifecycle('disconnected'));

    await act(async () => { await invoke(); });

    expect(useEditorStore.getState().currentDocument).toBe(before.currentDocument);
    expect(useEditorStore.getState().history).toBe(before.history);
    expect(useEditorStore.getState().undoCount).toBe(0);
    expect(useEditorStore.getState().redoCount).toBe(0);
    expect(useEditorStore.getState().lastCommandError).toMatch(/authoritative connection/);
  });
});
