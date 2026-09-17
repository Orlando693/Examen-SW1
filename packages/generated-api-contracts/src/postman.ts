import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import type { JsonObject, JsonValue, PostmanCollection, PostmanItem, ValidatedOpenApiContract } from './types.js';

const methods = ['post', 'get', 'put', 'delete'];
const isObject = (value: JsonValue | undefined): value is JsonObject => typeof value === 'object' && value !== null && !Array.isArray(value);
const reference = (schema: JsonObject | undefined) => typeof schema?.$ref === 'string' ? schema.$ref.split('/').at(-1) : undefined;
const objectAt = (value: JsonValue | undefined) => isObject(value) ? value : undefined;

function resolveSchema(document: JsonObject, schema: JsonObject | undefined): JsonObject | undefined {
  const name = reference(schema);
  if (!name) return schema;
  const schemas = objectAt(objectAt(document.components)?.schemas);
  return objectAt(schemas?.[name]);
}

function sample(schema: JsonObject | undefined, document: JsonObject): JsonValue {
  const resolved = resolveSchema(document, schema);
  if (!resolved) return null;
  if (Array.isArray(resolved.enum) && resolved.enum.length > 0) return resolved.enum[0] ?? null;
  if (resolved.type === 'string') {
    if (resolved.format === 'date') return '2026-01-01';
    if (resolved.format === 'date-time') return '2026-01-01T00:00:00Z';
    return 'sample';
  }
  if (resolved.type === 'integer' || resolved.type === 'number') return 1;
  if (resolved.type === 'boolean') return true;
  if (resolved.type === 'array') return [];
  const properties = objectAt(resolved.properties);
  if (!properties) return {};
  const required = new Set(Array.isArray(resolved.required) ? resolved.required.filter((item): item is string => typeof item === 'string') : []);
  return Object.fromEntries(Object.entries(properties).filter(([name]) => required.has(name)).sort(([left], [right]) => left.localeCompare(right)).map(([name, property]) => [name, sample(objectAt(property), document)]));
}

function requestSchema(operation: JsonObject): JsonObject | undefined {
  return objectAt(objectAt(objectAt(operation.requestBody)?.content)?.['application/json'])?.schema as JsonObject | undefined;
}

function parameters(operation: JsonObject): Array<{ key: string; value: string }> {
  const items = Array.isArray(operation.parameters) ? operation.parameters.filter(isObject) : [];
  return items.filter((item) => item.in === 'query' && typeof item.name === 'string').map((item) => ({ key: item.name as string, value: typeof objectAt(item.schema)?.default === 'string' || typeof objectAt(item.schema)?.default === 'number' ? String(objectAt(item.schema)?.default) : item.name === 'page' ? '0' : item.name === 'size' ? '20' : '' })).filter((item) => item.value !== '').sort((left, right) => left.key.localeCompare(right.key));
}

function url(path: string, query: Array<{ key: string; value: string }>) {
  const resolved = path.replaceAll('{id}', '{{resourceId}}').replaceAll('{relationship}', '{{relationship}}');
  return { raw: `{{baseUrl}}${resolved}${query.length ? `?${query.map((item) => `${item.key}=${item.value}`).join('&')}` : ''}`, host: ['{{baseUrl}}'], path: resolved.split('/').filter(Boolean), ...(query.length ? { query } : {}) };
}

function item(document: JsonObject, path: string, method: string, operation: JsonObject): PostmanItem {
  const query = parameters(operation);
  const schema = requestSchema(operation);
  return { name: `${method.toUpperCase()} ${path}`, request: { method: method.toUpperCase(), header: schema ? [{ key: 'Content-Type', value: 'application/json' }] : [], url: url(path, query), ...(schema ? { body: { mode: 'raw', raw: JSON.stringify(sample(schema, document)), options: { raw: { language: 'json' } } } } : {}) } };
}

function priority(path: string, method: string): number {
  if (method === 'post' && /^\/api\/[^/]+$/.test(path)) return 0;
  if (method === 'get' && /^\/api\/[^/]+$/.test(path)) return 1;
  if (path.endsWith('/count')) return 2;
  if (/\/{id}$/.test(path) && method === 'get') return 3;
  if (/\/{id}$/.test(path) && method === 'put') return 4;
  if (path.includes('/relationships/')) return 5;
  return 6;
}

export function generatePostmanCollection(contract: ValidatedOpenApiContract): PostmanCollection {
  const operations: Array<{ path: string; method: string; operation: JsonObject }> = [];
  const paths = objectAt(contract.document.paths) ?? {};
  for (const [path, pathItem] of Object.entries(paths)) {
    const itemObject = objectAt(pathItem);
    if (!itemObject || !path.startsWith('/api/')) continue;
    for (const method of methods) {
      const operationObject = objectAt(itemObject[method]);
      if (operationObject) operations.push({ path, method, operation: operationObject });
    }
  }
  operations.sort((left, right) => priority(left.path, left.method) - priority(right.path, right.method) || left.path.localeCompare(right.path) || methods.indexOf(left.method) - methods.indexOf(right.method));
  return { info: { name: 'Generated API', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' }, variable: [{ key: 'baseUrl', value: 'http://localhost:8080' }, { key: 'resourceId', value: '1' }, { key: 'relationship', value: 'relationships' }], item: operations.map((operation) => item(contract.document, operation.path, operation.method, operation.operation)) };
}

export async function writePostmanCollection(outputRoot: string, outputPath: string, collection: PostmanCollection): Promise<void> {
  const normalized = outputPath.replaceAll('\\', '/');
  const root = resolve(outputRoot);
  const destination = resolve(root, normalized);
  if (isAbsolute(normalized) || normalized.split('/').some((part) => part === '' || part === '..') || relative(root, destination).startsWith('..')) throw new Error('Postman output path must be a unique relative path contained by the selected output root.');
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(collection)}\n`);
}
