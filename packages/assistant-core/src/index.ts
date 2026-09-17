import {
  UmlCommandBus,
  type CommandResult,
  type Multiplicity,
  type PrimitiveTypeName,
  type ProjectDocument,
  type UmlCommand,
  type UmlRelationshipKind,
  type UmlTypeRef,
} from '@examen-sw1/uml-core';

export const ASSISTANT_COMMAND_VERSION = 1 as const;
export type AssistantOperation =
  | 'create_class' | 'rename_class' | 'delete_class'
  | 'add_attribute' | 'update_attribute' | 'delete_attribute'
  | 'create_relation' | 'update_relation' | 'delete_relation'
  | 'summarize_model' | 'needs_clarification';

export interface AssistantDiagnostic { code: string; message: string; path: string; }
export type ElementReference = { id: string } | { name: string };
export interface AssistantModelContext {
  projectId: string;
  revision: number;
  classes: Array<{ id: string; name: string; attributes: Array<{ id: string; name: string; type: UmlTypeRef }> }>;
  enumerations: Array<{ id: string; name: string }>;
  relationships: Array<{ id: string; name?: string; kind: UmlRelationshipKind; sourceClassId: string; targetClassId: string }>;
  selectedElementId?: string;
}

interface BaseCommand { version: 1; operation: AssistantOperation; }
export interface CreateClassCommand extends BaseCommand { operation: 'create_class'; name: string; classId?: string; }
export interface RenameClassCommand extends BaseCommand { operation: 'rename_class'; class: ElementReference; name: string; }
export interface DeleteClassCommand extends BaseCommand { operation: 'delete_class'; class: ElementReference; }
export interface AddAttributeCommand extends BaseCommand { operation: 'add_attribute'; class: ElementReference; name: string; attributeId?: string; attributeType: PrimitiveTypeName; }
export interface UpdateAttributeCommand extends BaseCommand { operation: 'update_attribute'; class: ElementReference; attribute: ElementReference; name?: string; attributeType?: PrimitiveTypeName; }
export interface DeleteAttributeCommand extends BaseCommand { operation: 'delete_attribute'; class: ElementReference; attribute: ElementReference; }
export interface CreateRelationCommand extends BaseCommand { operation: 'create_relation'; relationId?: string; kind: Exclude<UmlRelationshipKind, 'generalization'> | 'generalization'; source: ElementReference; target: ElementReference; name?: string; sourceMultiplicity?: Multiplicity; targetMultiplicity?: Multiplicity; }
export interface UpdateRelationCommand extends BaseCommand { operation: 'update_relation'; relation: ElementReference; name?: string | null; sourceMultiplicity?: Multiplicity | null; targetMultiplicity?: Multiplicity | null; }
export interface DeleteRelationCommand extends BaseCommand { operation: 'delete_relation'; relation: ElementReference; }
export interface SummarizeModelCommand extends BaseCommand { operation: 'summarize_model'; }
export interface NeedsClarificationCommand extends BaseCommand { operation: 'needs_clarification'; candidates: Array<{ id: string; name: string; kind: 'class' | 'attribute' | 'relationship' }>; }
export type AssistantCommand = CreateClassCommand | RenameClassCommand | DeleteClassCommand | AddAttributeCommand | UpdateAttributeCommand | DeleteAttributeCommand | CreateRelationCommand | UpdateRelationCommand | DeleteRelationCommand | SummarizeModelCommand | NeedsClarificationCommand;

export type DecodeResult = { ok: true; command: AssistantCommand } | { ok: false; diagnostics: AssistantDiagnostic[] };
const primitiveTypes = new Set<PrimitiveTypeName>(['string', 'number', 'boolean', 'date', 'datetime', 'void']);
const relationKinds = new Set<UmlRelationshipKind>(['association', 'aggregation', 'composition', 'generalization']);
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const validString = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 256 && !/https?:|\b(sql|select|drop|shell)\b/i.test(value);
const diagnostic = (code: string, message: string, path = '$'): DecodeResult => ({ ok: false, diagnostics: [{ code, message, path }] });
const hasOnly = (value: Record<string, unknown>, allowed: string[]): boolean => Object.keys(value).every((key) => allowed.includes(key));
const reference = (value: unknown): value is ElementReference => isRecord(value) && ((hasOnly(value, ['id']) && validString(value.id)) || (hasOnly(value, ['name']) && validString(value.name)));
const multiplicity = (value: unknown): value is Multiplicity => isRecord(value) && hasOnly(value, ['lower', 'upper']) && typeof value.lower === 'number' && Number.isInteger(value.lower) && (typeof value.upper === 'number' ? Number.isInteger(value.upper) && value.upper >= value.lower : value.upper === '*');
const optionalMultiplicity = (value: unknown): value is Multiplicity | undefined => value === undefined || multiplicity(value);
const optionalNullableMultiplicity = (value: unknown): value is Multiplicity | null | undefined => value === undefined || value === null || multiplicity(value);

/** Strictly decodes untrusted structured output; it never executes a command. */
export function decodeAssistantCommand(value: unknown): DecodeResult {
  if (!isRecord(value) || value.version !== ASSISTANT_COMMAND_VERSION || typeof value.operation !== 'string') return diagnostic('INVALID_SCHEMA', 'Assistant command must have version 1 and a known operation.');
  const base = value.version === 1;
  switch (value.operation) {
    case 'create_class': return base && hasOnly(value, ['version', 'operation', 'name', 'classId']) && validString(value.name) && (value.classId === undefined || validString(value.classId)) ? { ok: true, command: value as unknown as CreateClassCommand } : diagnostic('INVALID_SCHEMA', 'Invalid create_class command.');
    case 'rename_class': return base && hasOnly(value, ['version', 'operation', 'class', 'name']) && reference(value.class) && validString(value.name) ? { ok: true, command: value as unknown as RenameClassCommand } : diagnostic('INVALID_SCHEMA', 'Invalid rename_class command.');
    case 'delete_class': return base && hasOnly(value, ['version', 'operation', 'class']) && reference(value.class) ? { ok: true, command: value as unknown as DeleteClassCommand } : diagnostic('INVALID_SCHEMA', 'Invalid delete_class command.');
    case 'add_attribute': return base && hasOnly(value, ['version', 'operation', 'class', 'name', 'attributeId', 'attributeType']) && reference(value.class) && validString(value.name) && (value.attributeId === undefined || validString(value.attributeId)) && primitiveTypes.has(value.attributeType as PrimitiveTypeName) ? { ok: true, command: value as unknown as AddAttributeCommand } : diagnostic('INVALID_SCHEMA', 'Invalid add_attribute command.');
    case 'update_attribute': return base && hasOnly(value, ['version', 'operation', 'class', 'attribute', 'name', 'attributeType']) && reference(value.class) && reference(value.attribute) && (value.name === undefined || validString(value.name)) && (value.attributeType === undefined || primitiveTypes.has(value.attributeType as PrimitiveTypeName)) && (value.name !== undefined || value.attributeType !== undefined) ? { ok: true, command: value as unknown as UpdateAttributeCommand } : diagnostic('INVALID_SCHEMA', 'Invalid update_attribute command.');
    case 'delete_attribute': return base && hasOnly(value, ['version', 'operation', 'class', 'attribute']) && reference(value.class) && reference(value.attribute) ? { ok: true, command: value as unknown as DeleteAttributeCommand } : diagnostic('INVALID_SCHEMA', 'Invalid delete_attribute command.');
    case 'create_relation': return base && hasOnly(value, ['version', 'operation', 'relationId', 'kind', 'source', 'target', 'name', 'sourceMultiplicity', 'targetMultiplicity']) && (value.relationId === undefined || validString(value.relationId)) && relationKinds.has(value.kind as UmlRelationshipKind) && reference(value.source) && reference(value.target) && (value.name === undefined || validString(value.name)) && optionalMultiplicity(value.sourceMultiplicity) && optionalMultiplicity(value.targetMultiplicity) ? { ok: true, command: value as unknown as CreateRelationCommand } : diagnostic('INVALID_SCHEMA', 'Invalid create_relation command.');
    case 'update_relation': return base && hasOnly(value, ['version', 'operation', 'relation', 'name', 'sourceMultiplicity', 'targetMultiplicity']) && reference(value.relation) && (value.name === undefined || value.name === null || validString(value.name)) && optionalNullableMultiplicity(value.sourceMultiplicity) && optionalNullableMultiplicity(value.targetMultiplicity) && (value.name !== undefined || value.sourceMultiplicity !== undefined || value.targetMultiplicity !== undefined) ? { ok: true, command: value as unknown as UpdateRelationCommand } : diagnostic('INVALID_SCHEMA', 'Invalid update_relation command.');
    case 'delete_relation': return base && hasOnly(value, ['version', 'operation', 'relation']) && reference(value.relation) ? { ok: true, command: value as unknown as DeleteRelationCommand } : diagnostic('INVALID_SCHEMA', 'Invalid delete_relation command.');
    case 'summarize_model': return base && hasOnly(value, ['version', 'operation']) ? { ok: true, command: value as unknown as SummarizeModelCommand } : diagnostic('INVALID_SCHEMA', 'Invalid summarize_model command.');
    case 'needs_clarification': return diagnostic('PROVIDER_CLARIFICATION_UNSUPPORTED', 'Providers must return a resolvable command; clarification is generated by resolution.');
    default: return diagnostic('UNKNOWN_OPERATION', 'Assistant operation is not allowed.', '$.operation');
  }
}

export function createAssistantModelContext(document: ProjectDocument, selectedElementId?: string): AssistantModelContext {
  return {
    projectId: document.id, revision: document.revision,
    classes: document.model.classes.map((item) => ({ id: item.id, name: item.name, attributes: item.attributes.map((attribute) => ({ id: attribute.id, name: attribute.name, type: attribute.type })) })),
    enumerations: document.model.enumerations.map((item) => ({ id: item.id, name: item.name })),
    relationships: document.model.relationships.map((item) => ({ id: item.id, name: item.name, kind: item.kind, sourceClassId: item.source.classId, targetClassId: item.target.classId })),
    ...(selectedElementId === undefined ? {} : { selectedElementId }),
  };
}

type Resolution = { ok: true; id: string } | { ok: false; command: NeedsClarificationCommand | null; diagnostics: AssistantDiagnostic[] };
function resolve(referenceValue: ElementReference, candidates: Array<{ id: string; name: string }>, kind: 'class' | 'attribute' | 'relationship'): Resolution {
  if ('id' in referenceValue) return candidates.some((candidate) => candidate.id === referenceValue.id) ? { ok: true, id: referenceValue.id } : { ok: false, command: null, diagnostics: [{ code: 'UNRESOLVED_REFERENCE', message: `No ${kind} has the supplied canonical ID.`, path: '$' }] };
  const matched = candidates.filter((candidate) => candidate.name === referenceValue.name);
  if (matched.length === 1) return { ok: true, id: matched[0].id };
  if (matched.length > 1) return { ok: false, command: { version: 1, operation: 'needs_clarification', candidates: matched.map((candidate) => ({ ...candidate, kind })) }, diagnostics: [{ code: 'AMBIGUOUS_REFERENCE', message: `Multiple ${kind} elements have this name.`, path: '$' }] };
  return { ok: false, command: null, diagnostics: [{ code: 'UNRESOLVED_REFERENCE', message: `No ${kind} has this name.`, path: '$' }] };
}

export type ResolvedAssistantCommand = Exclude<AssistantCommand, RenameClassCommand | DeleteClassCommand | AddAttributeCommand | UpdateAttributeCommand | DeleteAttributeCommand | CreateRelationCommand | UpdateRelationCommand | DeleteRelationCommand> | { operation: 'rename_class'; classId: string; name: string } | { operation: 'delete_class'; classId: string } | { operation: 'add_attribute'; classId: string; name: string; attributeId?: string; attributeType: PrimitiveTypeName } | { operation: 'update_attribute'; classId: string; attributeId: string; name?: string; attributeType?: PrimitiveTypeName } | { operation: 'delete_attribute'; classId: string; attributeId: string } | { operation: 'create_relation'; relationId?: string; kind: UmlRelationshipKind; sourceClassId: string; targetClassId: string; name?: string; sourceMultiplicity?: Multiplicity; targetMultiplicity?: Multiplicity } | { operation: 'update_relation'; relationId: string; name?: string | null; sourceMultiplicity?: Multiplicity | null; targetMultiplicity?: Multiplicity | null } | { operation: 'delete_relation'; relationId: string };
export type ResolveResult = { ok: true; command: ResolvedAssistantCommand } | { ok: false; clarification?: NeedsClarificationCommand; diagnostics: AssistantDiagnostic[] };
export function resolveAssistantCommand(command: AssistantCommand, context: AssistantModelContext): ResolveResult {
  const classFor = (referenceValue: ElementReference) => resolve(referenceValue, context.classes, 'class');
  const relationFor = (referenceValue: ElementReference) => resolve(referenceValue, context.relationships.map(({ id, name }) => ({ id, name: name ?? id })), 'relationship');
  const failed = (result: Exclude<Resolution, { ok: true }>): ResolveResult => ({ ok: false, ...(result.command === null ? {} : { clarification: result.command }), diagnostics: result.diagnostics });
  if (command.operation === 'rename_class' || command.operation === 'delete_class' || command.operation === 'add_attribute' || command.operation === 'update_attribute' || command.operation === 'delete_attribute' || command.operation === 'create_relation') {
    const first = classFor(command.operation === 'create_relation' ? command.source : command.class); if (!first.ok) return failed(first);
    if (command.operation === 'create_relation') { const target = classFor(command.target); if (!target.ok) return failed(target); return { ok: true, command: { operation: 'create_relation', relationId: command.relationId, kind: command.kind, sourceClassId: first.id, targetClassId: target.id, name: command.name, sourceMultiplicity: command.sourceMultiplicity, targetMultiplicity: command.targetMultiplicity } }; }
    if (command.operation === 'rename_class') return { ok: true, command: { operation: command.operation, classId: first.id, name: command.name } };
    if (command.operation === 'delete_class') return { ok: true, command: { operation: command.operation, classId: first.id } };
    if (command.operation === 'add_attribute') return { ok: true, command: { operation: command.operation, classId: first.id, name: command.name, attributeId: command.attributeId, attributeType: command.attributeType } };
    const classItem = context.classes.find((item) => item.id === first.id)!; const attribute = resolve(command.attribute, classItem.attributes, 'attribute'); if (!attribute.ok) return failed(attribute);
    if (command.operation === 'update_attribute') return { ok: true, command: { operation: command.operation, classId: first.id, attributeId: attribute.id, name: command.name, attributeType: command.attributeType } };
    return { ok: true, command: { operation: command.operation, classId: first.id, attributeId: attribute.id } };
  }
  if (command.operation === 'update_relation' || command.operation === 'delete_relation') { const relation = relationFor(command.relation); if (!relation.ok) return failed(relation); return command.operation === 'update_relation' ? { ok: true, command: { operation: command.operation, relationId: relation.id, name: command.name, sourceMultiplicity: command.sourceMultiplicity, targetMultiplicity: command.targetMultiplicity } } : { ok: true, command: { operation: command.operation, relationId: relation.id } }; }
  return { ok: true, command };
}

export function isDestructive(command: ResolvedAssistantCommand): boolean { return command.operation === 'delete_class' || command.operation === 'delete_attribute' || command.operation === 'delete_relation'; }
export interface AssistantPreview { originalText: string; contextRevision: number; command: ResolvedAssistantCommand; affectedIds: string[]; summary: string; destructive: boolean; requiresConfirmation: boolean; diagnostics: AssistantDiagnostic[]; umlCommands: UmlCommand[]; }
export type PreviewResult = { ok: true; preview: AssistantPreview } | { ok: false; clarification?: NeedsClarificationCommand; diagnostics: AssistantDiagnostic[] };
export function toUmlCommands(command: ResolvedAssistantCommand): UmlCommand[] {
  switch (command.operation) {
    case 'create_class': return [{ type: 'CreateClass', ...(command.classId === undefined ? {} : { classId: command.classId }), name: command.name }];
    case 'rename_class': return [{ type: 'RenameClass', classId: command.classId, name: command.name }];
    case 'delete_class': return [{ type: 'DeleteClass', classId: command.classId }];
    case 'add_attribute': return [{ type: 'AddAttribute', classId: command.classId, ...(command.attributeId === undefined ? {} : { attributeId: command.attributeId }), name: command.name, attributeType: { kind: 'primitive', name: command.attributeType } }];
    case 'update_attribute': return [{ type: 'UpdateAttribute', classId: command.classId, attributeId: command.attributeId, ...(command.name === undefined ? {} : { name: command.name }), ...(command.attributeType === undefined ? {} : { attributeType: { kind: 'primitive', name: command.attributeType } }) }];
    case 'delete_attribute': return [{ type: 'RemoveAttribute', classId: command.classId, attributeId: command.attributeId }];
    case 'create_relation': return [command.kind === 'generalization' ? { type: 'CreateGeneralization', ...(command.relationId === undefined ? {} : { relationshipId: command.relationId }), sourceClassId: command.sourceClassId, targetClassId: command.targetClassId, ...(command.name === undefined ? {} : { name: command.name }) } : { type: 'CreateAssociation', ...(command.relationId === undefined ? {} : { relationshipId: command.relationId }), kind: command.kind, sourceClassId: command.sourceClassId, targetClassId: command.targetClassId, ...(command.name === undefined ? {} : { name: command.name }), ...(command.sourceMultiplicity === undefined ? {} : { sourceMultiplicity: command.sourceMultiplicity }), ...(command.targetMultiplicity === undefined ? {} : { targetMultiplicity: command.targetMultiplicity }) }];
    case 'update_relation': return [{ type: 'UpdateRelationship', relationshipId: command.relationId, ...(command.name === undefined ? {} : { name: command.name }), ...(command.sourceMultiplicity === undefined ? {} : { sourceMultiplicity: command.sourceMultiplicity }), ...(command.targetMultiplicity === undefined ? {} : { targetMultiplicity: command.targetMultiplicity }) }];
    case 'delete_relation': return [{ type: 'DeleteRelationship', relationshipId: command.relationId }];
    default: return [];
  }
}
export function createPreview(originalText: string, command: AssistantCommand, context: AssistantModelContext): PreviewResult {
  const resolved = resolveAssistantCommand(command, context); if (!resolved.ok) return { ok: false, ...(resolved.clarification === undefined ? {} : { clarification: resolved.clarification }), diagnostics: resolved.diagnostics };
  const umlCommands = toUmlCommands(resolved.command); const affectedIds = umlCommands.flatMap((item) => Object.values(item).filter((value): value is string => typeof value === 'string' && value !== item.type));
  const destructive = isDestructive(resolved.command);
  return { ok: true, preview: { originalText, contextRevision: context.revision, command: resolved.command, affectedIds, summary: resolved.command.operation.replaceAll('_', ' '), destructive, requiresConfirmation: destructive, diagnostics: [], umlCommands } };
}
export function cancelPreview(preview: AssistantPreview): { cancelled: true; contextRevision: number } {
  return { cancelled: true, contextRevision: preview.contextRevision };
}

export interface AssistantPermissionEvaluator { canApply(document: ProjectDocument, command: ResolvedAssistantCommand): boolean; }
export const allowAssistantCommands: AssistantPermissionEvaluator = { canApply: () => true };
export type ApplyResult = { ok: true; result?: CommandResult } | { ok: false; diagnostics: AssistantDiagnostic[] };
export function applyPreview(preview: AssistantPreview, document: ProjectDocument, options: { confirmed?: boolean; permissionEvaluator?: AssistantPermissionEvaluator; commandBus?: Pick<UmlCommandBus, 'execute'> } = {}): ApplyResult {
  if (preview.contextRevision !== document.revision) return { ok: false, diagnostics: [{ code: 'STALE_PREVIEW', message: 'The model changed after this preview.', path: '$.contextRevision' }] };
  if (preview.requiresConfirmation && options.confirmed !== true) return { ok: false, diagnostics: [{ code: 'CONFIRMATION_REQUIRED', message: 'Destructive action requires confirmation.', path: '$.confirmed' }] };
  const permissions = options.permissionEvaluator ?? allowAssistantCommands;
  if (!permissions.canApply(document, preview.command)) return { ok: false, diagnostics: [{ code: 'PERMISSION_DENIED', message: 'The current user cannot apply this action.', path: '$' }] };
  if (preview.umlCommands.length === 0) return { ok: true };
  const bus = options.commandBus ?? new UmlCommandBus(); let current = document; let result: CommandResult | undefined;
  for (const command of preview.umlCommands) { result = bus.execute(current, command); if (!result.ok) return { ok: false, diagnostics: result.diagnostics.map((item) => ({ code: item.code, message: item.message, path: item.path })) }; current = result.document; }
  return { ok: true, result };
}
export function summarizeModel(context: AssistantModelContext): string { return `${context.classes.length} classes, ${context.enumerations.length} enumerations, ${context.relationships.length} relationships`; }
export interface AssistantProvider { interpret(input: { text: string; context: AssistantModelContext; session?: Readonly<Record<string, string>> }): unknown; }
/** A deterministic provider for tests and local fixture-driven flows, never an LLM. */
export class RuleBasedAssistantProvider implements AssistantProvider {
  interpret(input: { text: string }): unknown {
    const text = input.text.trim(); if (text === 'summarize') return { version: 1, operation: 'summarize_model' };
    const create = /^create class ([A-Za-z][A-Za-z0-9_]*)$/.exec(text); if (create) return { version: 1, operation: 'create_class', name: create[1] };
    return { version: 1, operation: 'unsupported' };
  }
}
