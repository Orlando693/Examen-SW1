import { describe, expect, it } from 'vitest';
import { createProjectDocument, INITIAL_DOCUMENT_SCHEMA_VERSION, INITIAL_STORAGE_VERSION } from '@examen-sw1/uml-core';
import { toProjectPersistenceData, toProjectResource } from '../src/persistence/project-persistence.mapper.js';

describe('project persistence mapper', () => {
  const document = createProjectDocument({ id: '4f6de8d3-8044-48a1-b4b5-0e34e91015f5', name: 'Mapped', now: '2026-09-07T00:00:00.000Z' });
  const resource = { project: document, storageVersion: INITIAL_STORAGE_VERSION, documentSchemaVersion: INITIAL_DOCUMENT_SCHEMA_VERSION };

  it('keeps the canonical document revision separate from the storage version', () => {
    const data = toProjectPersistenceData(resource);

    expect(data).toMatchObject({
      id: document.id,
      revision: document.revision,
      storageVersion: 0,
      documentSchemaVersion: 1,
      model: document.model,
      layout: document.layout,
    });
  });

  it('decodes persisted JSONB data through the shared structural decoder', () => {
    const decoded = toProjectResource({
      ...toProjectPersistenceData(resource),
      description: null,
      ownerId: null,
    } as never);

    expect(decoded).toEqual(resource);
  });
});
