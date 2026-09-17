import { describe, expect, it } from 'vitest';
import { mapCanonicalUmlModel } from '@examen-sw1/relational-core';
import { validateGeneratedOpenApi, withGeneratedOpenApi } from '@examen-sw1/generated-api-contracts';
import { canonicalizeDomainManifest, generateDomainManifest, validateDomainManifest } from '../src/index.js';
import { knownCanonicalFixture, knownFixtureMetadata } from '../../spring-generator/test/known-canonical-fixture.js';

describe('DomainManifest', () => {
  it('derives a stable structural manifest without Canonical UML input', async () => {
    const mapped = mapCanonicalUmlModel(knownCanonicalFixture, knownFixtureMetadata);
    expect(mapped.success).toBe(true);
    if (!mapped.success) return;
    await withGeneratedOpenApi(knownCanonicalFixture, knownFixtureMetadata, async ({ document }) => {
      const contract = validateGeneratedOpenApi(document).contract;
      expect(contract).toBeDefined();
      if (!contract) return;
      const first = generateDomainManifest(mapped.model, contract);
      const second = generateDomainManifest(mapped.model, contract);
      expect(first.diagnostics).toEqual([]);
      expect(first.manifest).toEqual(second.manifest);
      expect(canonicalizeDomainManifest(first.manifest!)).not.toMatch(/\d{4}-\d{2}-\d{2}|[A-Z]:\\|\/tmp\//);
      expect(first.manifest?.version).toBe(1);
      expect(first.manifest?.entities.map((entity) => entity.name)).toContain('customer');
      expect(first.manifest?.entities.find((entity) => entity.name === 'customer')?.fields.some((field) => field.name === 'name' && field.searchable)).toBe(true);
      expect(validateDomainManifest(mapped.model, contract, first.manifest!)).toEqual([]);
      const invalid = structuredClone(first.manifest!);
      invalid.entities[0]!.fields[0]!.name = 'wrong';
      expect(validateDomainManifest(mapped.model, contract, invalid)).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'MANIFEST_SOURCE_MISMATCH' })]));
    });
  }, 300_000);
});
