import { create } from 'zustand';
import {
  UmlHistory,
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
import type { EditorSelection } from '../lib/editor/projection/project-document-to-flow';

export type EditorTool = 'select' | 'class' | 'enum' | 'association' | 'aggregation' | 'composition' | 'generalization';

interface RelationshipDraft {
  kind: Exclude<UmlRelationshipKind, 'generalization'> | 'generalization';
  sourceClassId?: string;
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
  updateMultiplicity: (relationshipId: string, endpoint: 'source' | 'target', multiplicity: Multiplicity) => CommandResult;
  deleteRelationship: (relationshipId: string) => CommandResult;
  moveNode: (elementId: string, position: { x: number; y: number }) => CommandResult;
  applyAutoLayout: () => Promise<CommandResult>;
  undo: () => void;
  redo: () => void;
}

const initialDocument = createDemoProjectDocument();
let generatedIdSequence = 0;

function nextGeneratedId(prefix: string): string {
  generatedIdSequence += 1;
  return `${prefix}-${generatedIdSequence}`;
}

function diagnosticsFor(document: ProjectDocument): ValidationDiagnostic[] {
  return validateProjectDocument(document).diagnostics;
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

function executeAndSync(history: UmlHistory, command: UmlCommand) {
  const result = history.execute(command);
  return {
    result,
    sync: result.ok ? syncFromHistory(history) : { lastCommandError: result.message, diagnostics: result.diagnostics },
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
  setSelection: (selection) => set((state) => (sameSelection(state.selection, selection) ? state : { selection })),
  setActiveTool: (activeTool) => set((state) => (state.activeTool === activeTool && state.relationshipDraft === null ? state : { activeTool, relationshipDraft: null, lastCommandError: null })),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  toggleInspector: () => set((state) => ({ isInspectorOpen: !state.isInspectorOpen })),
  createClass: () => {
    const id = nextGeneratedId('class');
    const { result, sync } = executeAndSync(get().history, { type: 'CreateClass', classId: id, name: 'NewClass' });
    set({ ...sync, selection: result.ok ? { type: 'class', id } : get().selection, lastCommandError: result.ok ? null : result.message });
    return result;
  },
  renameClass: (classId, name) => {
    const { result, sync } = executeAndSync(get().history, { type: 'RenameClass', classId, name });
    set({ ...sync, lastCommandError: result.ok ? null : result.message });
    return result;
  },
  deleteClass: (classId) => {
    const { result, sync } = executeAndSync(get().history, { type: 'DeleteClass', classId });
    set({ ...sync, selection: result.ok ? null : get().selection, lastCommandError: result.ok ? null : result.message });
    return result;
  },
  addAttribute: (classId) => {
    const { result, sync } = executeAndSync(get().history, { type: 'AddAttribute', classId, attributeId: nextGeneratedId('attr'), name: 'newAttribute', attributeType: stringType() });
    set({ ...sync, lastCommandError: result.ok ? null : result.message });
    return result;
  },
  updateAttribute: (classId, attributeId, name, attributeType) => {
    const { result, sync } = executeAndSync(get().history, { type: 'UpdateAttribute', classId, attributeId, name, attributeType });
    set({ ...sync, lastCommandError: result.ok ? null : result.message });
    return result;
  },
  removeAttribute: (classId, attributeId) => {
    const { result, sync } = executeAndSync(get().history, { type: 'RemoveAttribute', classId, attributeId });
    set({ ...sync, lastCommandError: result.ok ? null : result.message });
    return result;
  },
  createEnumeration: () => {
    const id = nextGeneratedId('enum');
    const { result, sync } = executeAndSync(get().history, { type: 'CreateEnumeration', enumerationId: id, name: 'NewEnum' });
    set({ ...sync, selection: result.ok ? { type: 'enumeration', id } : get().selection, lastCommandError: result.ok ? null : result.message });
    return result;
  },
  renameEnumeration: (enumerationId, name) => {
    const { result, sync } = executeAndSync(get().history, { type: 'RenameEnumeration', enumerationId, name });
    set({ ...sync, lastCommandError: result.ok ? null : result.message });
    return result;
  },
  deleteEnumeration: (enumerationId) => {
    const { result, sync } = executeAndSync(get().history, { type: 'DeleteEnumeration', enumerationId });
    set({ ...sync, selection: result.ok ? null : get().selection, lastCommandError: result.ok ? null : result.message });
    return result;
  },
  addEnumerationLiteral: (enumerationId) => {
    const { result, sync } = executeAndSync(get().history, { type: 'AddEnumerationLiteral', enumerationId, literalId: nextGeneratedId('literal'), name: 'NEW_LITERAL' });
    set({ ...sync, lastCommandError: result.ok ? null : result.message });
    return result;
  },
  updateEnumerationLiteral: (enumerationId, literalId, name) => {
    const { result, sync } = executeAndSync(get().history, { type: 'UpdateEnumerationLiteral', enumerationId, literalId, name });
    set({ ...sync, lastCommandError: result.ok ? null : result.message });
    return result;
  },
  removeEnumerationLiteral: (enumerationId, literalId) => {
    const { result, sync } = executeAndSync(get().history, { type: 'RemoveEnumerationLiteral', enumerationId, literalId });
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
    const relationshipId = nextGeneratedId('rel');
    const command: UmlCommand = draft.kind === 'generalization'
      ? { type: 'CreateGeneralization', relationshipId, sourceClassId: draft.sourceClassId, targetClassId }
      : { type: 'CreateAssociation', relationshipId, kind: draft.kind, sourceClassId: draft.sourceClassId, targetClassId, sourceMultiplicity: { lower: 1, upper: 1 }, targetMultiplicity: { lower: 0, upper: '*' } };
    const { result, sync } = executeAndSync(get().history, command);
    set({ ...sync, relationshipDraft: null, activeTool: 'select', selection: result.ok ? { type: 'relationship', id: command.relationshipId ?? '' } : get().selection, lastCommandError: result.ok ? null : result.message });
    return result;
  },
  updateMultiplicity: (relationshipId, endpoint, multiplicity) => {
    const { result, sync } = executeAndSync(get().history, { type: 'UpdateMultiplicity', relationshipId, endpoint, multiplicity });
    set({ ...sync, lastCommandError: result.ok ? null : result.message });
    return result;
  },
  deleteRelationship: (relationshipId) => {
    const { result, sync } = executeAndSync(get().history, { type: 'DeleteRelationship', relationshipId });
    set({ ...sync, selection: result.ok ? null : get().selection, lastCommandError: result.ok ? null : result.message });
    return result;
  },
  moveNode: (elementId, position) => {
    const { result, sync } = executeAndSync(get().history, { type: 'MoveNode', elementId, position });
    set({ ...sync, lastCommandError: result.ok ? null : result.message });
    return result;
  },
  applyAutoLayout: async () => {
    const command = await createAutoLayoutCommand(get().currentDocument);
    const { result, sync } = executeAndSync(get().history, command);
    set({ ...sync, lastCommandError: result.ok ? null : result.message });
    return result;
  },
  undo: () => {
    const result = get().history.undo();
    if (result.ok) {
      set({ ...syncFromHistory(get().history), lastCommandError: null });
    }
  },
  redo: () => {
    const result = get().history.redo();
    if (result.ok) {
      set({ ...syncFromHistory(get().history), lastCommandError: null });
    }
  },
}));

export function resetEditorStoreForTests(document = createDemoProjectDocument()) {
  const history = new UmlHistory(document);
  generatedIdSequence = 0;
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
  });
}
