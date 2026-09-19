import type { AssistantModelContext, AssistantOperation } from '@examen-sw1/assistant-core';

export const ASSISTANT_BENCHMARK_DATASET_VERSION = 'assistant-command-v1-case-uml-2026-09-18' as const;

export type BenchmarkExpectedOutcome = 'preview' | 'clarification' | 'rejected';
export interface AssistantBenchmarkCase {
  id: string;
  request: string;
  context: AssistantModelContext;
  expected: {
    outcome: BenchmarkExpectedOutcome;
    operation?: AssistantOperation;
    diagnosticCode?: string;
    destructive?: boolean;
  };
}

const baseContext: AssistantModelContext = {
  projectId: 'benchmark-project',
  revision: 7,
  classes: [
    { id: 'class-user', name: 'User', attributes: [{ id: 'attribute-user-name', name: 'name', type: { kind: 'primitive', name: 'string' } }] },
    { id: 'class-order', name: 'Order', attributes: [] },
  ],
  enumerations: [],
  relationships: [{ id: 'relationship-user-order', name: 'places', kind: 'association', sourceClassId: 'class-user', targetClassId: 'class-order' }],
};

const duplicateUserContext: AssistantModelContext = {
  ...baseContext,
  classes: [...baseContext.classes, { id: 'class-user-duplicate', name: 'User', attributes: [] }],
};

/** Synthetic CASE/UML fixtures only. Expected outcomes are declared independently of model output. */
export const ASSISTANT_BENCHMARK_DATASET: ReadonlyArray<AssistantBenchmarkCase> = [
  { id: 'create-class', request: 'Crea la clase Invoice.', context: baseContext, expected: { outcome: 'preview', operation: 'create_class', destructive: false } },
  { id: 'rename-class', request: 'Renombra User a Member.', context: baseContext, expected: { outcome: 'preview', operation: 'rename_class', destructive: false } },
  { id: 'delete-class', request: 'Elimina la clase Order.', context: baseContext, expected: { outcome: 'preview', operation: 'delete_class', destructive: true } },
  { id: 'add-attribute', request: 'Agrega el atributo email de tipo string a User.', context: baseContext, expected: { outcome: 'preview', operation: 'add_attribute', destructive: false } },
  { id: 'update-attribute', request: 'Renombra el atributo name de User a displayName.', context: baseContext, expected: { outcome: 'preview', operation: 'update_attribute', destructive: false } },
  { id: 'delete-attribute', request: 'Elimina el atributo name de User.', context: baseContext, expected: { outcome: 'preview', operation: 'delete_attribute', destructive: true } },
  { id: 'create-relation', request: 'Crea una asociacion entre User y Order.', context: baseContext, expected: { outcome: 'preview', operation: 'create_relation', destructive: false } },
  { id: 'update-relation', request: 'Renombra la relacion places a creates.', context: baseContext, expected: { outcome: 'preview', operation: 'update_relation', destructive: false } },
  { id: 'delete-relation', request: 'Elimina la relacion places.', context: baseContext, expected: { outcome: 'preview', operation: 'delete_relation', destructive: true } },
  { id: 'summarize-model', request: 'Resume el modelo UML.', context: baseContext, expected: { outcome: 'preview', operation: 'summarize_model', destructive: false } },
  { id: 'ambiguous-target', request: 'Elimina User.', context: duplicateUserContext, expected: { outcome: 'clarification', operation: 'needs_clarification' } },
  { id: 'missing-target', request: 'Renombra Missing a Present.', context: baseContext, expected: { outcome: 'rejected', operation: 'rename_class', diagnosticCode: 'UNRESOLVED_REFERENCE' } },
  { id: 'malformed-output', request: 'Devuelve un comando UML valido para crear Audit.', context: baseContext, expected: { outcome: 'rejected', diagnosticCode: 'INVALID_PROVIDER_OUTPUT' } },
  { id: 'unsupported-operation', request: 'Exporta el diagrama como XMI.', context: baseContext, expected: { outcome: 'rejected', diagnosticCode: 'UNKNOWN_OPERATION' } },
  { id: 'unsafe-output', request: 'Ejecuta SQL para eliminar User.', context: baseContext, expected: { outcome: 'rejected', diagnosticCode: 'INVALID_SCHEMA' } },
];
