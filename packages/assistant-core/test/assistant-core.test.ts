import { describe, expect, it, vi } from 'vitest';
import { UmlCommandBus, createProjectDocument, type ProjectDocument } from '@examen-sw1/uml-core';
import {
  ASSISTANT_COMMAND_JSON_SCHEMA,
  RuleBasedAssistantProvider,
  applyPreview,
  cancelPreview,
  createAssistantModelContext,
  createPreview,
  decodeAssistantCommand,
  summarizeModel,
  toUmlCommands,
  type AssistantCommand,
} from '../src/index.js';

function document(): ProjectDocument {
  return createProjectDocument({
    id: 'project-1', name: 'Assistant', revision: 4, now: '2026-09-17T00:00:00.000Z', layout: { nodes: [] },
    model: {
      packages: [], enumerations: [],
      classes: [
        { id: 'class-user', name: 'User', attributes: [{ id: 'attr-name', name: 'name', type: { kind: 'primitive', name: 'string' }, visibility: 'private' }], operations: [] },
        { id: 'class-order', name: 'Order', attributes: [], operations: [] },
      ],
      relationships: [{ id: 'relation-user-order', kind: 'association', source: { classId: 'class-user' }, target: { classId: 'class-order' } }],
    },
  });
}

const commands: AssistantCommand[] = [
  { version: 1, operation: 'create_class', name: 'Invoice' },
  { version: 1, operation: 'rename_class', class: { id: 'class-user' }, name: 'Member' },
  { version: 1, operation: 'delete_class', class: { id: 'class-user' } },
  { version: 1, operation: 'add_attribute', class: { id: 'class-user' }, name: 'email', attributeType: 'string' },
  { version: 1, operation: 'update_attribute', class: { id: 'class-user' }, attribute: { id: 'attr-name' }, name: 'displayName' },
  { version: 1, operation: 'delete_attribute', class: { id: 'class-user' }, attribute: { id: 'attr-name' } },
  { version: 1, operation: 'create_relation', kind: 'association', source: { id: 'class-user' }, target: { id: 'class-order' } },
  { version: 1, operation: 'update_relation', relation: { id: 'relation-user-order' }, name: 'places' },
  { version: 1, operation: 'delete_relation', relation: { id: 'relation-user-order' } },
  { version: 1, operation: 'summarize_model' },
];

describe('AssistantCommand v1 schema', () => {
  it('accepts every supported command operation', () => {
    for (const command of commands) expect(decodeAssistantCommand(command)).toMatchObject({ ok: true });
    expect(ASSISTANT_COMMAND_JSON_SCHEMA.oneOf.map((shape) => shape.properties.operation.const).sort()).toEqual(commands.map((command) => command.operation).sort());
  });

  it('fails closed for unknown, incomplete, unsafe, and extra data', () => {
    expect(decodeAssistantCommand({ version: 1, operation: 'anything' })).toMatchObject({ ok: false, diagnostics: [{ code: 'UNKNOWN_OPERATION' }] });
    expect(decodeAssistantCommand({ version: 1, operation: 'rename_class', class: { id: 'class-user' } })).toMatchObject({ ok: false });
    expect(decodeAssistantCommand({ version: 1, operation: 'create_class', name: 'https://unsafe' })).toMatchObject({ ok: false });
    expect(decodeAssistantCommand({ version: 1, operation: 'summarize_model', injected: true })).toMatchObject({ ok: false });
  });
});

describe('assistant model context and resolution', () => {
  it('is serializable, excludes layout, resolves IDs and unique names, and summarizes without mutation', () => {
    const source = document(); const before = structuredClone(source); const context = createAssistantModelContext(source);
    expect(JSON.parse(JSON.stringify(context))).toEqual(context);
    expect(context).not.toHaveProperty('layout');
    expect(summarizeModel(context)).toBe('2 classes, 0 enumerations, 1 relationships');
    expect(createPreview('rename', { version: 1, operation: 'rename_class', class: { name: 'User' }, name: 'Member' }, context)).toMatchObject({ ok: true });
    expect(source).toEqual(before);
  });

  it('returns unresolved and clarification results without silent selection', () => {
    const source = document(); const duplicate = structuredClone(source); duplicate.model.classes.push({ id: 'class-user-2', name: 'User', attributes: [], operations: [] });
    expect(createPreview('missing', { version: 1, operation: 'delete_class', class: { id: 'missing' } }, createAssistantModelContext(source))).toMatchObject({ ok: false, diagnostics: [{ code: 'UNRESOLVED_REFERENCE' }] });
    expect(createPreview('duplicate', { version: 1, operation: 'delete_class', class: { name: 'User' } }, createAssistantModelContext(duplicate))).toMatchObject({ ok: false, clarification: { operation: 'needs_clarification', candidates: [{ id: 'class-user' }, { id: 'class-user-2' }] } });
  });
});

describe('preview and command bus application', () => {
  it('creates a side-effect-free preview and dispatches only via the command bus', () => {
    const source = document(); const before = structuredClone(source); const bus = { execute: vi.fn(new UmlCommandBus().execute.bind(new UmlCommandBus())) };
    const preview = createPreview('rename User', { version: 1, operation: 'rename_class', class: { id: 'class-user' }, name: 'Member' }, createAssistantModelContext(source));
    expect(preview.ok).toBe(true); expect(source).toEqual(before); expect(bus.execute).not.toHaveBeenCalled();
    if (!preview.ok) return;
    const result = applyPreview(preview.preview, source, { commandBus: bus });
    expect(result.ok).toBe(true); expect(bus.execute).toHaveBeenCalledWith(source, { type: 'RenameClass', classId: 'class-user', name: 'Member' });
    expect(source).toEqual(before);
  });

  it('requires confirmation for every destructive operation and permits confirmed execution', () => {
    for (const command of commands.filter((item) => ['delete_class', 'delete_attribute', 'delete_relation'].includes(item.operation))) {
      const source = document(); const preview = createPreview('delete', command, createAssistantModelContext(source));
      expect(preview.ok && preview.preview.requiresConfirmation).toBe(true);
      if (!preview.ok) continue;
      const bus = { execute: vi.fn(new UmlCommandBus().execute.bind(new UmlCommandBus())) };
      expect(applyPreview(preview.preview, source, { commandBus: bus })).toMatchObject({ ok: false, diagnostics: [{ code: 'CONFIRMATION_REQUIRED' }] });
      expect(bus.execute).not.toHaveBeenCalled();
      expect(applyPreview(preview.preview, source, { confirmed: true, commandBus: bus }).ok).toBe(true);
      expect(bus.execute).toHaveBeenCalledTimes(1);
    }
  });

  it('cancels a preview without executing or mutating the source document', () => {
    const source = document(); const before = structuredClone(source);
    const preview = createPreview('rename', { version: 1, operation: 'rename_class', class: { id: 'class-user' }, name: 'Member' }, createAssistantModelContext(source));
    if (!preview.ok) throw new Error('fixture must preview');
    expect(cancelPreview(preview.preview)).toEqual({ cancelled: true, contextRevision: 4 });
    expect(source).toEqual(before);
  });

  it('revalidates stale, permission, cancellation, target, and semantic failures before the supplied bus', () => {
    const source = document(); const preview = createPreview('rename', { version: 1, operation: 'rename_class', class: { id: 'class-user' }, name: 'Member' }, createAssistantModelContext(source));
    if (!preview.ok) throw new Error('fixture must preview');
    const bus = { execute: vi.fn(new UmlCommandBus().execute.bind(new UmlCommandBus())) };
    expect(applyPreview(preview.preview, { ...source, revision: 5 }, { commandBus: bus })).toMatchObject({ ok: false, diagnostics: [{ code: 'STALE_PREVIEW' }] });
    expect(applyPreview(preview.preview, source, { permissionEvaluator: { canApply: () => false }, commandBus: bus })).toMatchObject({ ok: false, diagnostics: [{ code: 'PERMISSION_DENIED' }] });
    expect(applyPreview(preview.preview, source, { cancelled: true, commandBus: bus })).toMatchObject({ ok: false, diagnostics: [{ code: 'CANCELLED' }] });
    const targets: Array<[AssistantCommand, ProjectDocument, string]> = [
      [{ version: 1, operation: 'rename_class', class: { id: 'class-user' }, name: 'Member' }, { ...source, model: { ...source.model, classes: source.model.classes.filter((item) => item.id !== 'class-user') } }, 'TARGET_CLASS_MISSING'],
      [{ version: 1, operation: 'delete_attribute', class: { id: 'class-user' }, attribute: { id: 'attr-name' } }, { ...source, model: { ...source.model, classes: source.model.classes.map((item) => item.id === 'class-user' ? { ...item, attributes: [] } : item) } }, 'TARGET_ATTRIBUTE_MISSING'],
      [{ version: 1, operation: 'delete_relation', relation: { id: 'relation-user-order' } }, { ...source, model: { ...source.model, relationships: [] } }, 'TARGET_RELATIONSHIP_MISSING'],
    ];
    for (const [command, currentDocument, target] of targets) {
      const targetPreview = createPreview('target', command, createAssistantModelContext(source));
      if (targetPreview.ok) expect(applyPreview(targetPreview.preview, currentDocument, { confirmed: true, commandBus: bus })).toMatchObject({ ok: false, diagnostics: [{ code: target }] });
    }
    const semanticPreview = createPreview('relation', { version: 1, operation: 'update_relation', relation: { id: 'relation-user-order' }, sourceMultiplicity: { lower: 1, upper: '*' } }, createAssistantModelContext(source));
    if (!semanticPreview.ok) throw new Error('fixture must preview');
    const generalization = structuredClone(source); generalization.model.relationships[0] = { id: 'relation-user-order', kind: 'generalization', source: { classId: 'class-user' }, target: { classId: 'class-order' } };
    expect(applyPreview(semanticPreview.preview, generalization, { commandBus: bus })).toMatchObject({ ok: false });
    expect(bus.execute).not.toHaveBeenCalled();
  });

  it('uses no provider and calls the supplied bus exactly once after pre-apply checks succeed', () => {
    const source = document(); const bus = { execute: vi.fn(new UmlCommandBus().execute.bind(new UmlCommandBus())) }; const provider = { interpret: vi.fn() };
    const preview = createPreview('rename', { version: 1, operation: 'rename_class', class: { id: 'class-user' }, name: 'Member' }, createAssistantModelContext(source));
    if (!preview.ok) throw new Error('fixture must preview');
    expect(applyPreview(preview.preview, source, { commandBus: bus })).toMatchObject({ ok: true });
    expect(provider.interpret).not.toHaveBeenCalled();
    expect(bus.execute).toHaveBeenCalledTimes(1);
  });

  it('adapts all mutation families to existing UML commands', () => {
    const context = createAssistantModelContext(document());
    for (const command of commands.filter((item) => item.operation !== 'summarize_model')) {
      const preview = createPreview('test', command, context);
      if (preview.ok) expect(preview.preview.umlCommands).toEqual(toUmlCommands(preview.preview.command));
    }
  });

  it('sends every supported mutation family to the bus without pre-apply mutation', () => {
    const mutable = commands.filter((item) => item.operation !== 'summarize_model');
    for (const command of mutable) {
      const source = document(); const before = structuredClone(source); const bus = { execute: vi.fn(new UmlCommandBus().execute.bind(new UmlCommandBus())) };
      const preview = createPreview('test', command, createAssistantModelContext(source));
      if (!preview.ok) continue;
      const result = applyPreview(preview.preview, source, { commandBus: bus, confirmed: true });
      expect(result.ok).toBe(true);
      expect(bus.execute).toHaveBeenCalledTimes(1);
      expect(source).toEqual(before);
    }
  });
});

describe('deterministic provider', () => {
  it('returns the same structured candidate for identical input', () => {
    const provider = new RuleBasedAssistantProvider(); const input = { text: 'create class Invoice', context: createAssistantModelContext(document()) };
    expect(provider.interpret(input)).toEqual(provider.interpret(input));
    expect(decodeAssistantCommand(provider.interpret(input))).toMatchObject({ ok: true, command: { operation: 'create_class', name: 'Invoice' } });
    expect(decodeAssistantCommand(provider.interpret({ ...input, text: 'unsafe text' }))).toMatchObject({ ok: false });
  });
});
