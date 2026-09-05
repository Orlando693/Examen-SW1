import { describe, expect, it } from 'vitest';
import {
  createProjectDocument,
  validateProjectDocument,
  stringType,
  type ProjectDocument,
} from '../src/index.js';

function baseDocument(): ProjectDocument {
  return createProjectDocument({
    id: 'project-1',
    name: 'Valid',
    now: '2026-09-04T00:00:00.000Z',
    model: {
      packages: [],
      classes: [
        { id: 'class-a', name: 'Customer', attributes: [{ id: 'attr-a', name: 'name', visibility: 'private', type: stringType() }], operations: [] },
        { id: 'class-b', name: 'Order', attributes: [], operations: [] },
      ],
      enumerations: [],
      relationships: [
        { id: 'rel-a', kind: 'association', source: { classId: 'class-a', multiplicity: { lower: 1, upper: 1 } }, target: { classId: 'class-b', multiplicity: { lower: 0, upper: '*' } } },
      ],
    },
    layout: { nodes: [{ id: 'node-a', elementId: 'class-a', position: { x: 0, y: 0 } }] },
  });
}

describe('validateProjectDocument', () => {
  it('accepts a valid model without blocking errors', () => {
    const result = validateProjectDocument(baseDocument());

    expect(result.hasErrors).toBe(false);
    expect(result.errors).toHaveLength(0);
  });

  it('detects duplicate identifiers', () => {
    const document = baseDocument();
    document.model.classes[1].id = 'class-a';

    const result = validateProjectDocument(document);

    expect(result.errors.some((diagnostic) => diagnostic.code === 'DUPLICATE_ID')).toBe(true);
  });

  it('reports the public diagnostic contract for validation errors', () => {
    const document = baseDocument();
    document.model.classes[0].id = 'class-b';

    const result = validateProjectDocument(document);

    expect(result.errors[0]).toEqual({
      severity: 'ERROR',
      code: 'DUPLICATE_ID',
      message: "Duplicate id 'class-b' also appears at model.classes[0].id.",
      path: 'model.classes[1].id',
      elementId: 'class-b',
      elementType: 'UmlClass',
    });
  });

  it('detects missing relationship references', () => {
    const document = baseDocument();
    document.model.relationships[0].target.classId = 'missing-class';

    const result = validateProjectDocument(document);

    expect(result.errors.some((diagnostic) => diagnostic.code === 'MISSING_REFERENCE')).toBe(true);
  });

  it('detects missing layout references', () => {
    const document = baseDocument();
    document.layout.nodes[0].elementId = 'missing-element';

    const result = validateProjectDocument(document);

    expect(result.errors.some((diagnostic) => diagnostic.code === 'MISSING_LAYOUT_REFERENCE')).toBe(true);
  });

  it('detects invalid multiplicities', () => {
    const document = baseDocument();
    document.model.relationships[0].target.multiplicity = { lower: 3, upper: 1 };

    const result = validateProjectDocument(document);

    expect(result.errors.some((diagnostic) => diagnostic.code === 'INVALID_MULTIPLICITY')).toBe(true);
  });

  it('detects malformed relationships', () => {
    const document = baseDocument();
    document.model.relationships[0].source.classId = '';

    const result = validateProjectDocument(document);

    expect(result.errors.some((diagnostic) => diagnostic.code === 'MALFORMED_RELATIONSHIP')).toBe(true);
  });

  it('detects invalid generalizations including self references', () => {
    const document = baseDocument();
    document.model.relationships = [{ id: 'gen-a', kind: 'generalization', source: { classId: 'class-a' }, target: { classId: 'class-a' } }];

    const result = validateProjectDocument(document);

    expect(result.errors.some((diagnostic) => diagnostic.code === 'INVALID_GENERALIZATION')).toBe(true);
  });

  it('detects invalid required names and structures', () => {
    const document = baseDocument();
    document.model.classes[0].attributes[0].name = '';

    const result = validateProjectDocument(document);

    expect(result.errors.some((diagnostic) => diagnostic.code === 'INVALID_NAME')).toBe(true);
  });

  it('reports non-blocking warnings', () => {
    const document = baseDocument();
    document.model.classes[0].name = 'customer';

    const result = validateProjectDocument(document);

    expect(result.hasErrors).toBe(false);
    expect(result.warnings).toEqual([
      expect.objectContaining({ severity: 'WARNING', code: 'CLASS_NAME_NOT_UPPERCASE', elementId: 'class-a' }),
    ]);
  });
});
