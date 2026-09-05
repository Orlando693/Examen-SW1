import { describe, expect, it } from 'vitest';
import {
  UmlCommandBus,
  UmlHistory,
  createProjectDocument,
  stringType,
  type UmlCommand,
  type ProjectDocument,
} from '../src/index.js';

function emptyDocument(): ProjectDocument {
  return createProjectDocument({ id: 'project-1', name: 'Commands', now: '2026-09-04T00:00:00.000Z' });
}

function twoClassDocument(): ProjectDocument {
  return createProjectDocument({
    id: 'project-1',
    name: 'Commands',
    now: '2026-09-04T00:00:00.000Z',
    model: {
      packages: [],
      classes: [
        { id: 'class-a', name: 'Customer', attributes: [], operations: [] },
        { id: 'class-b', name: 'Order', attributes: [], operations: [] },
      ],
      enumerations: [],
      relationships: [],
    },
    layout: { nodes: [] },
  });
}

describe('UmlCommandBus', () => {
  it('creates classes through the command bus without mutating the original document', () => {
    const document = emptyDocument();
    const result = new UmlCommandBus().execute(document, { type: 'CreateClass', classId: 'class-a', name: 'Customer' });

    expect(result.ok).toBe(true);
    expect(result.ok && result.document.model.classes).toHaveLength(1);
    expect(document.model.classes).toHaveLength(0);
  });

  it('renames classes through the command bus', () => {
    const result = new UmlCommandBus().execute(twoClassDocument(), { type: 'RenameClass', classId: 'class-a', name: 'Client' });

    expect(result.ok && result.document.model.classes[0].name).toBe('Client');
  });

  it('manages attributes through commands', () => {
    const bus = new UmlCommandBus();
    const added = bus.execute(twoClassDocument(), { type: 'AddAttribute', classId: 'class-a', attributeId: 'attr-a', name: 'name', attributeType: stringType() });
    expect(added.ok && added.document.model.classes[0].attributes[0].name).toBe('name');

    const updated = added.ok ? bus.execute(added.document, { type: 'UpdateAttribute', classId: 'class-a', attributeId: 'attr-a', name: 'fullName' }) : added;
    expect(updated.ok && updated.document.model.classes[0].attributes[0].name).toBe('fullName');

    const removed = updated.ok ? bus.execute(updated.document, { type: 'RemoveAttribute', classId: 'class-a', attributeId: 'attr-a' }) : updated;
    expect(removed.ok && removed.document.model.classes[0].attributes).toHaveLength(0);
  });

  it('creates associations and updates multiplicity through commands', () => {
    const bus = new UmlCommandBus();
    const created = bus.execute(twoClassDocument(), {
      type: 'CreateAssociation',
      relationshipId: 'rel-a',
      sourceClassId: 'class-a',
      targetClassId: 'class-b',
      targetMultiplicity: { lower: 0, upper: '*' },
    });
    expect(created.ok && created.document.model.relationships[0].kind).toBe('association');

    const updated = created.ok ? bus.execute(created.document, { type: 'UpdateMultiplicity', relationshipId: 'rel-a', endpoint: 'target', multiplicity: { lower: 1, upper: 5 } }) : created;
    expect(updated.ok && updated.document.model.relationships[0].target.multiplicity).toEqual({ lower: 1, upper: 5 });
  });

  it('changes only layout when moving nodes', () => {
    const document = twoClassDocument();
    const semanticBefore = JSON.stringify(document.model);
    const result = new UmlCommandBus().execute(document, { type: 'MoveNode', elementId: 'class-a', nodeId: 'node-a', position: { x: 20, y: 30 } });

    expect(result.ok && result.document.layout.nodes[0].position).toEqual({ x: 20, y: 30 });
    expect(result.ok && JSON.stringify(result.document.model)).toBe(semanticBefore);
  });

  it('rejects commands that reference missing elements', () => {
    const result = new UmlCommandBus().execute(emptyDocument(), { type: 'RenameClass', classId: 'missing', name: 'Nope' });

    expect(result).toMatchObject({ ok: false, reason: 'NOT_FOUND' });
  });

  it('rejects unsupported runtime commands without mutating the project document', () => {
    const document = twoClassDocument();
    const unsupportedCommand = { type: 'CreateEnumeration', enumerationId: 'enum-a', name: 'Status' } as unknown as UmlCommand;
    const result = new UmlCommandBus().execute(document, unsupportedCommand);

    expect(result).toMatchObject({ ok: false, reason: 'UNSUPPORTED_COMMAND' });
    expect(result.document).toEqual(document);
    expect(document.model.enumerations).toHaveLength(0);
  });

  it('rejects commands that produce blocking validation errors', () => {
    const result = new UmlCommandBus().execute(twoClassDocument(), { type: 'RenameClass', classId: 'class-a', name: '' });

    expect(result).toMatchObject({ ok: false, reason: 'VALIDATION_FAILED' });
    expect(result.diagnostics.some((diagnostic) => diagnostic.severity === 'ERROR')).toBe(true);
  });
});

describe('UmlHistory', () => {
  it('undoes and redoes accepted commands deterministically', () => {
    const history = new UmlHistory(emptyDocument());
    history.execute({ type: 'CreateClass', classId: 'class-a', name: 'Customer' });

    const undo = history.undo();
    expect(undo.ok).toBe(true);
    expect(undo.document.model.classes).toHaveLength(0);

    const redo = history.redo();
    expect(redo.ok).toBe(true);
    expect(redo.document.model.classes[0].id).toBe('class-a');
  });

  it('clears redo when a new command is executed after undo', () => {
    const history = new UmlHistory(emptyDocument());
    history.execute({ type: 'CreateClass', classId: 'class-a', name: 'Customer' });
    history.undo();
    expect(history.redoCount).toBe(1);

    history.execute({ type: 'CreateClass', classId: 'class-b', name: 'Order' });

    expect(history.redoCount).toBe(0);
    expect(history.redo().ok).toBe(false);
  });

  it('enforces the configured history limit', () => {
    const history = new UmlHistory(emptyDocument(), { historyLimit: 2 });
    history.execute({ type: 'CreateClass', classId: 'class-a', name: 'A' });
    history.execute({ type: 'CreateClass', classId: 'class-b', name: 'B' });
    history.execute({ type: 'CreateClass', classId: 'class-c', name: 'C' });

    expect(history.undoCount).toBe(2);
    expect(history.undo().document.model.classes.map((umlClass) => umlClass.id)).toEqual(['class-a', 'class-b']);
    expect(history.undo().document.model.classes.map((umlClass) => umlClass.id)).toEqual(['class-a']);
    expect(history.undo().ok).toBe(false);
  });
});
