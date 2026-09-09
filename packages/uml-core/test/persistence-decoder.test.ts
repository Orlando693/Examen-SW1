import { describe, expect, it } from 'vitest';
import {
  createProjectDocument,
  decodeProjectResource,
  decodeSerializedProjectDocument,
  INITIAL_DOCUMENT_SCHEMA_VERSION,
  INITIAL_STORAGE_VERSION,
  stringType,
  validateProjectDocument,
} from '../src/index.js';

describe('project persistence decoder', () => {
  const document = createProjectDocument({
    id: 'project-1',
    name: 'Persistence',
    now: '2026-09-07T00:00:00.000Z',
    model: {
      packages: [],
      classes: [{ id: 'class-1', name: 'Person', attributes: [{ id: 'attribute-1', name: 'name', type: stringType(), visibility: 'private' }], operations: [] }],
      enumerations: [],
      relationships: [],
    },
  });

  it('decodes the versioned persistence envelope without running semantic validation', () => {
    const result = decodeProjectResource({
      project: document,
      storageVersion: INITIAL_STORAGE_VERSION,
      documentSchemaVersion: INITIAL_DOCUMENT_SCHEMA_VERSION,
    });

    expect(result).toEqual({
      ok: true,
      value: {
        project: document,
        storageVersion: 0,
        documentSchemaVersion: 1,
      },
    });
  });

  it('reports malformed JSON and unsupported discriminators structurally', () => {
    expect(decodeSerializedProjectDocument('{')).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'MALFORMED_JSON', path: '$' }],
    });

    const invalid = structuredClone(document) as { model: { classes: Array<{ attributes: Array<{ type: { kind: string } }> }> } };
    invalid.model.classes[0].attributes[0].type.kind = 'sql';
    expect(decodeProjectResource({ project: invalid, storageVersion: 0, documentSchemaVersion: 1 })).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'UNSUPPORTED_DISCRIMINATOR', path: 'project.model.classes[0].attributes[0].type.kind' }],
    });
  });

  it('rejects unsupported persisted document schema versions', () => {
    expect(decodeProjectResource({ project: document, storageVersion: 0, documentSchemaVersion: 2 })).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'UNSUPPORTED_DOCUMENT_SCHEMA_VERSION', path: 'resource.documentSchemaVersion' }],
    });
  });

  it('accepts all supported relationship and type variants structurally', () => {
    const variants = createProjectDocument({
      id: 'project-variants',
      name: 'Variants',
      now: '2026-09-07T00:00:00.000Z',
      model: {
        packages: [{ id: 'package-1', name: 'Domain', generation: { entity: true } }],
        classes: [
          { id: 'class-a', name: 'Base', packageId: 'package-1', attributes: [{ id: 'attribute-custom', name: 'code', type: { kind: 'custom', name: 'Code' }, visibility: 'public' }], operations: [] },
          { id: 'class-b', name: 'Child', attributes: [{ id: 'attribute-class', name: 'base', type: { kind: 'class', classId: 'class-a' }, visibility: 'private' }, { id: 'attribute-enum', name: 'status', type: { kind: 'enumeration', enumerationId: 'enum-1' }, visibility: 'protected' }], operations: [] },
        ],
        enumerations: [{ id: 'enum-1', name: 'Status', literals: [{ id: 'literal-1', name: 'OPEN', generation: { sortable: true, defaultSort: 'asc' } }] }],
        relationships: [
          { id: 'association-1', kind: 'association', source: { classId: 'class-a' }, target: { classId: 'class-b' } },
          { id: 'aggregation-1', kind: 'aggregation', source: { classId: 'class-a' }, target: { classId: 'class-b' } },
          { id: 'composition-1', kind: 'composition', source: { classId: 'class-a' }, target: { classId: 'class-b' } },
          { id: 'generalization-1', kind: 'generalization', source: { classId: 'class-b' }, target: { classId: 'class-a' } },
        ],
      },
    });

    expect(decodeProjectResource({ project: variants, storageVersion: 0, documentSchemaVersion: 1 })).toMatchObject({ ok: true });
  });

  it('leaves semantic warnings and errors to validateProjectDocument after decoding', () => {
    const warningDocument = structuredClone(document);
    warningDocument.model.classes[0].name = 'person';
    const warningDecode = decodeProjectResource({ project: warningDocument, storageVersion: 0, documentSchemaVersion: 1 });
    expect(warningDecode).toMatchObject({ ok: true });
    if (warningDecode.ok) {
      expect(validateProjectDocument(warningDecode.value.project).hasErrors).toBe(false);
      expect(validateProjectDocument(warningDecode.value.project).warnings).toHaveLength(1);
    }

    const invalidDocument = structuredClone(document);
    invalidDocument.model.classes[0].attributes[0].name = '';
    const invalidDecode = decodeProjectResource({ project: invalidDocument, storageVersion: 0, documentSchemaVersion: 1 });
    expect(invalidDecode).toMatchObject({ ok: true });
    if (invalidDecode.ok) {
      expect(validateProjectDocument(invalidDecode.value.project).hasErrors).toBe(true);
    }
  });
});
