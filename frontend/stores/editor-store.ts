import { create } from 'zustand';
import {
  UmlHistory,
  createUuid,
  stringType,
  validateProjectDocument,
  type CommandResult,
  type Multiplicity,
  type ProjectDocument,
  type UmlCommand,
  type UmlRelationshipKind,
  type UmlTypeRef,
  type ValidationDiagnostic,
} from '@examen-sw1/uml-core';
import { createDemoProjectDocument } from '../lib/editor/demo/demo-document';
import { createAutoLayoutCommand } from '../lib/editor/layout/auto-layout';
import { projectApi, type ProjectApiError } from '../lib/projects/project-api';
import type { EditorSelection } from '../lib/editor/projection/project-document-to-flow';
import type { RealtimeCommandGate } from '../lib/collaboration/realtime-command-gate';

export type EditorTool = 'select' | 'class' | 'enum' | 'association' | 'aggregation' | 'composition' | 'generalization';
export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'conflict';

export interface PersistibleSnapshot {
  metadata: ProjectDocument['metadata'];
  model: ProjectDocument['model'];
  layout: ProjectDocument['layout'];
}

interface RelationshipDraft {
  kind: Exclude<UmlRelationshipKind, 'generalization'> | 'generalization';
  sourceClassId?: string;
}

interface RelationshipDetails {
  name?: string;
  sourceMultiplicity?: Multiplicity;
  targetMultiplicity?: Multiplicity;
}

interface EditorStore {
  history: UmlHistory;
  currentDocument: ProjectDocument;
  diagnostics: ValidationDiagnostic[];
  selection: EditorSelection;
  activeTool: EditorTool;
  relationshipDraft: RelationshipDraft | null;
  isSidebarOpen: boolean;
  isInspectorOpen: boolean;
  lastCommandError: string | null;
  undoCount: number;
  redoCount: number;
  projectId: string | null;
  storageVersion: number | null;
  savedPersistentSnapshot: PersistibleSnapshot | null;
  saveState: SaveState;
  operationalError: string | null;
  realtimeCommandGate: RealtimeCommandGate | null;
  realtimeCommandPending: boolean;
  setSelection: (selection: EditorSelection) => void;
  setActiveTool: (tool: EditorTool) => void;
  toggleSidebar: () => void;
  toggleInspector: () => void;
  createClass: () => CommandResult;
  renameClass: (classId: string, name: string) => CommandResult;
  deleteClass: (classId: string) => CommandResult;
  addAttribute: (classId: string) => CommandResult;
  updateAttribute: (classId: string, attributeId: string, name?: string, attributeType?: UmlTypeRef) => CommandResult;
  removeAttribute: (classId: string, attributeId: string) => CommandResult;
  createEnumeration: () => CommandResult;
  renameEnumeration: (enumerationId: string, name: string) => CommandResult;
  deleteEnumeration: (enumerationId: string) => CommandResult;
  addEnumerationLiteral: (enumerationId: string) => CommandResult;
  updateEnumerationLiteral: (enumerationId: string, literalId: string, name: string) => CommandResult;
  removeEnumerationLiteral: (enumerationId: string, literalId: string) => CommandResult;
  startRelationship: (kind: RelationshipDraft['kind'], sourceClassId: string) => void;
  cancelRelationship: () => void;
  completeRelationship: (targetClassId: string) => CommandResult | null;
  createRelationship: (kind: RelationshipDraft['kind'], sourceClassId: string, targetClassId: string, details?: RelationshipDetails) => CommandResult | null;
  updateMultiplicity: (relationshipId: string, endpoint: 'source' | 'target', multiplicity: Multiplicity) => CommandResult;
  updateRelationship: (relationshipId: string, details: { name: string | null; sourceMultiplicity?: Multiplicity | null; targetMultiplicity?: Multiplicity | null }) => CommandResult;
  deleteRelationship: (relationshipId: string) => CommandResult;
  moveNode: (elementId: string, position: { x: number; y: number }) => CommandResult;
  applyAutoLayout: () => Promise<CommandResult>;
  replaceProjectSession: (resource: { project: ProjectDocument; storageVersion: number }) => void;
  installAuthoritativeDocument: (resource: { project: ProjectDocument; storageVersion: number }) => void;
  rebaseHistoryToCurrentDocument: () => void;
  save: () => Promise<void>;
  reloadProject: () => Promise<void>;
  undo: () => void;
  redo: () => void;
  setRealtimeCommandGate: (gate: RealtimeCommandGate | null) => void;
  setRealtimeCommandPending: (pending: boolean) => void;
  setRealtimeCommandError: (message: string) => void;
}

const initialDocument = createDemoProjectDocument();

function diagnosticsFor(document: ProjectDocument): ValidationDiagnostic[] {
  return validateProjectDocument(document).diagnostics;
}

function persistibleSnapshot(document: ProjectDocument): PersistibleSnapshot {
  return structuredClone({ metadata: document.metadata, model: document.model, layout: document.layout });
}

function snapshotsEqual(left: PersistibleSnapshot | null, right: PersistibleSnapshot): boolean {
  return left !== null && JSON.stringify(left) === JSON.stringify(right);
}

function saveStateFor(document: ProjectDocument, saved: PersistibleSnapshot | null): SaveState {
  return snapshotsEqual(saved, persistibleSnapshot(document)) ? 'idle' : 'dirty';
}

function syncFromHistory(history: UmlHistory) {
  const currentDocument = history.document;
  return {
    currentDocument,
    diagnostics: diagnosticsFor(currentDocument),
      undoCount: history.undoCount,
      redoCount: history.redoCount,
  };
}

function executeAndSync(history: UmlHistory, command: UmlCommand, gate: RealtimeCommandGate | null) {
  if (gate) {
    const submission = gate.submitRealtimeCommand(command);
    const result: CommandResult = submission.accepted
      ? { ok: true, command, document: history.document, diagnostics: [] }
      : { ok: false, command, document: history.document, reason: 'INVALID_COMMAND', message: submission.message, diagnostics: [] };
    return { result, sync: result.ok ? { lastCommandError: null } : { lastCommandError: result.message } };
  }
  const result = history.execute(command);
  return {
    result,
    sync: result.ok ? { ...syncFromHistory(history), saveState: 'dirty' as const } : { lastCommandError: result.message, diagnostics: result.diagnostics },
  };
}

function createRelationshipCommand(kind: RelationshipDraft['kind'], sourceClassId: string, targetClassId: string, details: RelationshipDetails = {}): Extract<UmlCommand, { type: 'CreateAssociation' | 'CreateGeneralization' }> {
  const relationshipId = createUuid();
  return kind === 'generalization'
    ? { type: 'CreateGeneralization', relationshipId, sourceClassId, targetClassId, ...(details.name === undefined ? {} : { name: details.name }) }
    : {
      type: 'CreateAssociation',
      relationshipId,
      kind,
      sourceClassId,
      targetClassId,
      ...(details.name === undefined ? {} : { name: details.name }),
      ...(details.sourceMultiplicity === undefined ? {} : { sourceMultiplicity: details.sourceMultiplicity }),
      ...(details.targetMultiplicity === undefined ? {} : { targetMultiplicity: details.targetMultiplicity }),
    };
}

function sameSelection(a: EditorSelection, b: EditorSelection): boolean {
  if (a === null || b === null) {
    return a === b;
  }
  return a.type === b.type && a.id === b.id;
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  history: new UmlHistory(initialDocument),
  currentDocument: initialDocument,
  diagnostics: diagnosticsFor(initialDocument),
  selection: null,
  activeTool: 'select',
  relationshipDraft: null,
  isSidebarOpen: false,
  isInspectorOpen: false,
  lastCommandError: null,
  undoCount: 0,
  redoCount: 0,
  projectId: null,
  storageVersion: null,
  savedPersistentSnapshot: null,
  saveState: 'idle',
  operationalError: null,
  realtimeCommandGate: null,
  realtimeCommandPending: false,
  setSelection: (selection) => set((state) => (sameSelection(state.selection, selection) ? state : { selection })),
  setActiveTool: (activeTool) => set((state) => (state.activeTool === activeTool && state.relationshipDraft === null ? state : { activeTool, relationshipDraft: null, lastCommandError: null })),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  toggleInspector: () => set((state) => ({ isInspectorOpen: !state.isInspectorOpen })),
  setRealtimeCommandGate: (realtimeCommandGate) => set((state) => state.realtimeCommandGate === realtimeCommandGate ? state : { realtimeCommandGate }),
  setRealtimeCommandPending: (realtimeCommandPending) => set((state) => state.realtimeCommandPending === realtimeCommandPending ? state : { realtimeCommandPending }),
  setRealtimeCommandError: (message) => set({ lastCommandError: message }),
  createClass: () => {
    const id = createUuid();
    const { result, sync } = executeAndSync(get().history, { type: 'CreateClass', classId: id, name: 'NewClass' }, get().realtimeCommandGate);
    set({ ...sync, selection: result.ok ? { type: 'class', id } : get().selection, lastCommandError: result.ok ? null : result.message });
    return result;
  },
  renameClass: (classId, name) => {
    const { result, sync } = executeAndSync(get().history, { type: 'RenameClass', classId, name }, get().realtimeCommandGate);
    set({ ...sync, saveState: result.ok ? saveStateFor(get().history.document, get().savedPersistentSnapshot) : get().saveState, lastCommandError: result.ok ? null : result.message });
    return result;
  },
  deleteClass: (classId) => {
    const { result, sync } = executeAndSync(get().history, { type: 'DeleteClass', classId }, get().realtimeCommandGate);
    set({ ...sync, selection: result.ok ? null : get().selection, lastCommandError: result.ok ? null : result.message });
    return result;
  },
  addAttribute: (classId) => {
    const { result, sync } = executeAndSync(get().history, { type: 'AddAttribute', classId, attributeId: createUuid(), name: 'newAttribute', attributeType: stringType() }, get().realtimeCommandGate);
    set({ ...sync, lastCommandError: result.ok ? null : result.message });
    return result;
  },
  updateAttribute: (classId, attributeId, name, attributeType) => {
    const { result, sync } = executeAndSync(get().history, { type: 'UpdateAttribute', classId, attributeId, name, attributeType }, get().realtimeCommandGate);
    set({ ...sync, lastCommandError: result.ok ? null : result.message });
    return result;
  },
  removeAttribute: (classId, attributeId) => {
    const { result, sync } = executeAndSync(get().history, { type: 'RemoveAttribute', classId, attributeId }, get().realtimeCommandGate);
    set({ ...sync, lastCommandError: result.ok ? null : result.message });
    return result;
  },
  createEnumeration: () => {
    const id = createUuid();
    const { result, sync } = executeAndSync(get().history, { type: 'CreateEnumeration', enumerationId: id, name: 'NewEnum' }, get().realtimeCommandGate);
    set({ ...sync, selection: result.ok ? { type: 'enumeration', id } : get().selection, lastCommandError: result.ok ? null : result.message });
    return result;
  },
  renameEnumeration: (enumerationId, name) => {
    const { result, sync } = executeAndSync(get().history, { type: 'RenameEnumeration', enumerationId, name }, get().realtimeCommandGate);
    set({ ...sync, lastCommandError: result.ok ? null : result.message });
    return result;
  },
  deleteEnumeration: (enumerationId) => {
    const { result, sync } = executeAndSync(get().history, { type: 'DeleteEnumeration', enumerationId }, get().realtimeCommandGate);
    set({ ...sync, selection: result.ok ? null : get().selection, lastCommandError: result.ok ? null : result.message });
    return result;
  },
  addEnumerationLiteral: (enumerationId) => {
    const { result, sync } = executeAndSync(get().history, { type: 'AddEnumerationLiteral', enumerationId, literalId: createUuid(), name: 'NEW_LITERAL' }, get().realtimeCommandGate);
    set({ ...sync, lastCommandError: result.ok ? null : result.message });
    return result;
  },
  updateEnumerationLiteral: (enumerationId, literalId, name) => {
    const { result, sync } = executeAndSync(get().history, { type: 'UpdateEnumerationLiteral', enumerationId, literalId, name }, get().realtimeCommandGate);
    set({ ...sync, lastCommandError: result.ok ? null : result.message });
    return result;
  },
  removeEnumerationLiteral: (enumerationId, literalId) => {
    const { result, sync } = executeAndSync(get().history, { type: 'RemoveEnumerationLiteral', enumerationId, literalId }, get().realtimeCommandGate);
    set({ ...sync, lastCommandError: result.ok ? null : result.message });
    return result;
  },
  startRelationship: (kind, sourceClassId) => set({ relationshipDraft: { kind, sourceClassId }, activeTool: kind, selection: { type: 'class', id: sourceClassId }, lastCommandError: null }),
  cancelRelationship: () => set({ relationshipDraft: null, activeTool: 'select', lastCommandError: null }),
  completeRelationship: (targetClassId) => {
    const draft = get().relationshipDraft;
    if (!draft?.sourceClassId) {
      return null;
    }
    if (draft.sourceClassId === targetClassId) {
      set({ relationshipDraft: null, activeTool: 'select', lastCommandError: 'No se puede crear una relacion de una clase hacia si misma en CU-02.' });
      return null;
    }
    const command = createRelationshipCommand(draft.kind, draft.sourceClassId, targetClassId);
    const { result, sync } = executeAndSync(get().history, command, get().realtimeCommandGate);
    set({ ...sync, relationshipDraft: null, activeTool: 'select', selection: result.ok ? { type: 'relationship', id: command.relationshipId ?? '' } : get().selection, lastCommandError: result.ok ? null : result.message });
    return result;
  },
  createRelationship: (kind, sourceClassId, targetClassId, details) => {
    if (sourceClassId === targetClassId) {
      set({ lastCommandError: 'No se puede crear una relacion de una clase hacia si misma en CU-02.' });
      return null;
    }
    const command = createRelationshipCommand(kind, sourceClassId, targetClassId, details);
    const { result, sync } = executeAndSync(get().history, command, get().realtimeCommandGate);
    set({ ...sync, selection: result.ok ? { type: 'relationship', id: command.relationshipId ?? '' } : get().selection, lastCommandError: result.ok ? null : result.message });
    return result;
  },
  updateMultiplicity: (relationshipId, endpoint, multiplicity) => {
    const { result, sync } = executeAndSync(get().history, { type: 'UpdateMultiplicity', relationshipId, endpoint, multiplicity }, get().realtimeCommandGate);
    set({ ...sync, lastCommandError: result.ok ? null : result.message });
    return result;
  },
  updateRelationship: (relationshipId, details) => {
    const { result, sync } = executeAndSync(get().history, { type: 'UpdateRelationship', relationshipId, ...details }, get().realtimeCommandGate);
    set({ ...sync, saveState: result.ok ? saveStateFor(get().history.document, get().savedPersistentSnapshot) : get().saveState, lastCommandError: result.ok ? null : result.message });
    return result;
  },
  deleteRelationship: (relationshipId) => {
    const { result, sync } = executeAndSync(get().history, { type: 'DeleteRelationship', relationshipId }, get().realtimeCommandGate);
    set({ ...sync, selection: result.ok ? null : get().selection, lastCommandError: result.ok ? null : result.message });
    return result;
  },
  moveNode: (elementId, position) => {
    const { result, sync } = executeAndSync(get().history, { type: 'MoveNode', elementId, position }, get().realtimeCommandGate);
    set({ ...sync, lastCommandError: result.ok ? null : result.message });
    return result;
  },
  applyAutoLayout: async () => {
    const document = get().currentDocument;
    const projectId = get().projectId;
    const command = await createAutoLayoutCommand(document);
    if (get().currentDocument !== document || get().projectId !== projectId) {
      return { ok: false, command, document, reason: 'INVALID_COMMAND', message: 'Auto layout result belongs to a previous project session.', diagnostics: [] };
    }
    const { result, sync } = executeAndSync(get().history, command, get().realtimeCommandGate);
    set({ ...sync, lastCommandError: result.ok ? null : result.message });
    return result;
  },
  undo: () => {
    if (get().realtimeCommandGate) return;
    const result = get().history.undo();
    if (result.ok) {
      set({ ...syncFromHistory(get().history), saveState: saveStateFor(get().history.document, get().savedPersistentSnapshot), lastCommandError: null });
    }
  },
  redo: () => {
    if (get().realtimeCommandGate) return;
    const result = get().history.redo();
    if (result.ok) {
      set({ ...syncFromHistory(get().history), saveState: saveStateFor(get().history.document, get().savedPersistentSnapshot), lastCommandError: null });
    }
  },
  replaceProjectSession: (resource) => {
    const validation = validateProjectDocument(resource.project);
    if (validation.diagnostics.some((diagnostic) => diagnostic.severity === 'ERROR')) {
      throw new Error('The server returned a project with blocking UML diagnostics.');
    }
    const history = new UmlHistory(resource.project);
    set({
      history,
      ...syncFromHistory(history),
      selection: null,
      activeTool: 'select',
      relationshipDraft: null,
      isSidebarOpen: false,
      isInspectorOpen: false,
      lastCommandError: null,
      projectId: resource.project.id,
      storageVersion: resource.storageVersion,
      savedPersistentSnapshot: persistibleSnapshot(resource.project),
      saveState: 'idle',
      operationalError: null,
    });
  },
  installAuthoritativeDocument: (resource) => {
    const validation = validateProjectDocument(resource.project);
    if (validation.diagnostics.some((diagnostic) => diagnostic.severity === 'ERROR')) {
      throw new Error('The server returned a project with blocking UML diagnostics.');
    }
    const history = new UmlHistory(resource.project);
    set({
      history,
      ...syncFromHistory(history),
      projectId: resource.project.id,
      storageVersion: resource.storageVersion,
      savedPersistentSnapshot: persistibleSnapshot(resource.project),
      saveState: 'saved',
      operationalError: null,
      lastCommandError: null,
    });
  },
  rebaseHistoryToCurrentDocument: () => {
    const history = new UmlHistory(get().currentDocument);
    set({ history, ...syncFromHistory(history) });
  },
  save: async () => {
    const state = get();
    if (state.realtimeCommandGate || !state.projectId || state.storageVersion === null || state.saveState === 'saving') return;
    const projectId = state.projectId;
    const document = state.currentDocument;
    const storageVersion = state.storageVersion;
    set({ saveState: 'saving', operationalError: null });
    try {
      const resource = await projectApi.saveDocument(projectId, { baseStorageVersion: storageVersion, document: { revision: document.revision, model: document.model, layout: document.layout } });
      if (get().projectId !== projectId || get().currentDocument !== document) return;
      set({ storageVersion: resource.storageVersion, savedPersistentSnapshot: persistibleSnapshot(resource.project), saveState: 'saved', operationalError: null });
    } catch (cause) {
      if (get().projectId !== projectId) return;
      const error = cause as ProjectApiError;
      set({ saveState: error.code === 'PROJECT_REVISION_CONFLICT' ? 'conflict' : 'error', operationalError: error.message });
    }
  },
  reloadProject: async () => {
    const projectId = get().projectId;
    if (!projectId || !window.confirm('Reload the authoritative project? Unsaved local changes will be discarded.')) return;
    try {
      const resource = await projectApi.get(projectId);
      if (get().projectId === projectId) get().replaceProjectSession(resource);
    } catch (cause) {
      if (get().projectId === projectId) set({ operationalError: cause instanceof Error ? cause.message : 'Unable to reload project.', saveState: get().saveState });
    }
  },
}));

export function resetEditorStoreForTests(document = createDemoProjectDocument()) {
  const history = new UmlHistory(document);
  useEditorStore.setState({
    history,
    currentDocument: document,
    diagnostics: diagnosticsFor(document),
    selection: null,
    activeTool: 'select',
    relationshipDraft: null,
    isSidebarOpen: false,
    isInspectorOpen: false,
    lastCommandError: null,
    undoCount: 0,
    redoCount: 0,
    projectId: null,
    storageVersion: null,
    savedPersistentSnapshot: null,
    saveState: 'idle',
    operationalError: null,
    realtimeCommandGate: null,
    realtimeCommandPending: false,
  });
}
