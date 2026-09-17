import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { executePostmanCollection, generatePostmanCollection, validateGeneratedOpenApi, withGeneratedOpenApi, writePostmanCollection } from '../src/index.js';
import { knownCanonicalFixture, knownFixtureMetadata } from '../../spring-generator/test/known-canonical-fixture.js';

const document = {
  openapi: '3.1.0',
  servers: [{ url: 'http://machine-specific:8080' }],
  paths: {
    '/api/account': {
      get: { parameters: [{ name: 'search', in: 'query' }, { name: 'size', in: 'query' }, { name: 'page', in: 'query' }, { name: 'sort', in: 'query' }], responses: { 200: { description: 'OK' }, 400: { description: 'Bad request' } } },
      post: { requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateAccountRequest' } } } }, responses: { 201: { description: 'Created' }, 400: { description: 'Bad request' } } },
    },
    '/api/account/count': { get: { responses: { 200: { description: 'OK' } } } },
    '/api/account/{id}': {
      get: { responses: { 200: { description: 'OK' }, 404: { description: 'Not found' } } },
      put: { requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateAccountRequest' } } } }, responses: { 200: { description: 'OK' }, 400: { description: 'Bad request' }, 404: { description: 'Not found' } } },
      delete: { responses: { 204: { description: 'Deleted' }, 404: { description: 'Not found' } } },
    },
    '/api/account/{id}/relationships/{relationship}': { get: { responses: { 200: { description: 'OK' }, 404: { description: 'Not found' } } } },
  },
  components: { schemas: { CreateAccountRequest: { type: 'object', required: ['name'], properties: { name: { type: 'string' } } }, UpdateAccountRequest: { type: 'object', properties: { name: { type: 'string' } } } } },
};

describe('generated API contracts', () => {
  it('validates generated CRUD contract structure and normalizes volatile servers', () => {
    const result = validateGeneratedOpenApi(document);
    expect(result.diagnostics).toEqual([]);
    expect(result.contract?.entityPaths).toEqual(['/api/account']);
    expect(result.contract?.document.servers).toBeUndefined();
  });

  it('fails closed when a documented generated operation is absent', () => {
    const incomplete = structuredClone(document) as typeof document;
    delete (incomplete.paths['/api/account/{id}'] as { delete?: unknown }).delete;
    expect(validateGeneratedOpenApi(incomplete).diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'MISSING_CRUD_OPERATION' })]));
  });

  it('derives a stable Postman collection from validated OpenAPI only', () => {
    const first = validateGeneratedOpenApi(document).contract;
    const reordered = structuredClone(document);
    reordered.paths['/api/account'].get.parameters.reverse();
    const second = validateGeneratedOpenApi(reordered).contract;
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (!first || !second) return;
    const collection = generatePostmanCollection(first);
    expect(collection).toEqual(generatePostmanCollection(second));
    expect(JSON.stringify(collection)).not.toMatch(/machine-specific|[A-Z]:\\|\/tmp\//);
    expect(collection.item.map((item) => item.name)).toEqual(['POST /api/account', 'GET /api/account', 'GET /api/account/count', 'GET /api/account/{id}', 'PUT /api/account/{id}', 'GET /api/account/{id}/relationships/{relationship}', 'DELETE /api/account/{id}']);
    expect(collection.item.find((item) => item.name === 'POST /api/account')?.request.body?.raw).toBe('{"name":"sample"}');
  });

  it('materializes only safe Postman output paths', async () => {
    const contract = validateGeneratedOpenApi(document).contract;
    expect(contract).toBeDefined();
    if (!contract) return;
    const root = await mkdtemp(join(tmpdir(), 'generated-postman-'));
    try {
      const collection = generatePostmanCollection(contract);
      await writePostmanCollection(root, 'contracts/generated.postman_collection.json', collection);
      await expect(readFile(join(root, 'contracts', 'generated.postman_collection.json'), 'utf8')).resolves.toBe(`${JSON.stringify(collection)}\n`);
      await expect(writePostmanCollection(root, '../escape.json', collection)).rejects.toThrow('relative path');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('extracts, persists, validates, and exercises a real generated Spring OpenAPI contract', async () => {
    await withGeneratedOpenApi(knownCanonicalFixture, knownFixtureMetadata, async ({ document: extracted, baseUrl, persistedOpenApiPath }) => {
      await expect(access(persistedOpenApiPath)).resolves.toBeUndefined();
      expect(await readFile(persistedOpenApiPath, 'utf8')).toContain('"openapi"');
      const result = validateGeneratedOpenApi(extracted);
      expect(result.diagnostics).toEqual([]);
      expect(result.contract).toBeDefined();
      if (!result.contract) return;
      const collection = generatePostmanCollection(result.contract);
      const root = collection.item.find((item) => item.request.method === 'POST')?.request.url.path.join('/');
      expect(root).toBeDefined();
      const executions = await executePostmanCollection(collection, baseUrl, (item) => item.request.url.path.join('/').startsWith(root ?? '') && !item.request.url.path.includes('relationships'));
      expect(executions.map((item) => item.status)).toEqual([201, 200, 200, 200, 200, 204]);
    });
  }, 300_000);
});
