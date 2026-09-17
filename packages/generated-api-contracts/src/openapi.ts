import type { ContractDiagnostic, JsonObject, JsonValue, ValidatedOpenApiContract } from './types.js';

type HttpMethod = 'delete' | 'get' | 'post' | 'put';
const isObject = (value: JsonValue | undefined): value is JsonObject => typeof value === 'object' && value !== null && !Array.isArray(value);
const asObject = (value: JsonValue | undefined, path: string, diagnostics: ContractDiagnostic[]): JsonObject | undefined => {
  if (isObject(value)) return value;
  diagnostics.push({ code: 'INVALID_OPENAPI_STRUCTURE', message: 'Expected an object.', path });
  return undefined;
};
const asString = (value: JsonValue | undefined): string | undefined => typeof value === 'string' ? value : undefined;

export function canonicalizeOpenApi(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(canonicalizeOpenApi).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'servers').sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, canonicalizeOpenApi(item)]));
}

function operation(pathItem: JsonObject, method: HttpMethod, path: string, diagnostics: ContractDiagnostic[]) {
  const candidate = asObject(pathItem[method], `paths.${path}.${method}`, diagnostics);
  if (!candidate) return undefined;
  const responses = asObject(candidate.responses, `paths.${path}.${method}.responses`, diagnostics);
  return responses ? { candidate, responses } : undefined;
}

function hasResponse(responses: JsonObject, code: string): boolean { return isObject(responses[code]); }

function validateEntity(path: string, pathItem: JsonObject, paths: JsonObject, diagnostics: ContractDiagnostic[]) {
  const collectionGet = operation(pathItem, 'get', path, diagnostics);
  const collectionPost = operation(pathItem, 'post', path, diagnostics);
  if (!collectionGet || !collectionPost) {
    diagnostics.push({ code: 'MISSING_CRUD_OPERATION', message: 'Generated entity collection requires GET and POST operations.', path: `paths.${path}` });
    return;
  }
  for (const parameter of ['page', 'size', 'sort', 'search']) {
    const parameters = Array.isArray(collectionGet.candidate.parameters) ? collectionGet.candidate.parameters : [];
    if (!parameters.some((item) => isObject(item) && item.name === parameter && item.in === 'query')) diagnostics.push({ code: 'MISSING_QUERY_PARAMETER', message: `Expected query parameter ${parameter}.`, path: `paths.${path}.get.parameters` });
  }
  if (!hasResponse(collectionPost.responses, '201') || !hasResponse(collectionPost.responses, '400')) diagnostics.push({ code: 'MISSING_DOCUMENTED_RESPONSE', message: 'Create requires documented 201 and 400 responses.', path: `paths.${path}.post.responses` });
  if (!asObject(collectionPost.candidate.requestBody, `paths.${path}.post.requestBody`, diagnostics)) diagnostics.push({ code: 'MISSING_DTO', message: 'Create requires a documented request DTO.', path: `paths.${path}.post` });

  const idPath = `${path}/{id}`;
  const idItem = asObject(paths[idPath], `paths.${idPath}`, diagnostics);
  if (idItem) {
    const get = operation(idItem, 'get', idPath, diagnostics);
    const put = operation(idItem, 'put', idPath, diagnostics);
    const remove = operation(idItem, 'delete', idPath, diagnostics);
    if (!get || !put || !remove) diagnostics.push({ code: 'MISSING_CRUD_OPERATION', message: 'Generated entity item requires GET, PUT, and DELETE operations.', path: `paths.${idPath}` });
    if (get && (!hasResponse(get.responses, '200') || !hasResponse(get.responses, '404'))) diagnostics.push({ code: 'MISSING_DOCUMENTED_RESPONSE', message: 'Get requires documented 200 and 404 responses.', path: `paths.${idPath}.get.responses` });
    if (put && (!hasResponse(put.responses, '200') || !hasResponse(put.responses, '400') || !hasResponse(put.responses, '404'))) diagnostics.push({ code: 'MISSING_DOCUMENTED_RESPONSE', message: 'Update requires documented 200, 400, and 404 responses.', path: `paths.${idPath}.put.responses` });
    if (remove && (!hasResponse(remove.responses, '204') || !hasResponse(remove.responses, '404'))) diagnostics.push({ code: 'MISSING_DOCUMENTED_RESPONSE', message: 'Delete requires documented 204 and 404 responses.', path: `paths.${idPath}.delete.responses` });
  }
  const count = operation(asObject(paths[`${path}/count`], `paths.${path}/count`, diagnostics) ?? {}, 'get', `${path}/count`, diagnostics);
  if (!count || !hasResponse(count.responses, '200')) diagnostics.push({ code: 'MISSING_COUNT_OPERATION', message: 'Generated entity requires a documented count operation.', path: `paths.${path}/count` });
  const relationship = operation(asObject(paths[`${path}/{id}/relationships/{relationship}`], `paths.${path}/{id}/relationships/{relationship}`, diagnostics) ?? {}, 'get', `${path}/{id}/relationships/{relationship}`, diagnostics);
  if (!relationship || !hasResponse(relationship.responses, '200') || !hasResponse(relationship.responses, '404')) diagnostics.push({ code: 'MISSING_RELATIONSHIP_OPERATION', message: 'Generated entity requires documented relationship navigation.', path: `paths.${path}/{id}/relationships/{relationship}` });
}

export function validateGeneratedOpenApi(input: JsonValue): { contract?: ValidatedOpenApiContract; diagnostics: ContractDiagnostic[] } {
  const diagnostics: ContractDiagnostic[] = [];
  const document = asObject(input, 'document', diagnostics);
  if (!document || asString(document.openapi) === undefined) return { diagnostics };
  const paths = asObject(document.paths, 'paths', diagnostics);
  if (!paths) return { diagnostics };
  const entityPaths = Object.keys(paths).filter((path) => /^\/api\/[^/]+$/.test(path)).sort();
  if (entityPaths.length === 0) diagnostics.push({ code: 'MISSING_GENERATED_ENTITIES', message: 'No generated entity collection paths were found.', path: 'paths' });
  for (const path of entityPaths) {
    const pathItem = asObject(paths[path], `paths.${path}`, diagnostics);
    if (pathItem) validateEntity(path, pathItem, paths, diagnostics);
  }
  if (diagnostics.length > 0) return { diagnostics };
  return { contract: { document: canonicalizeOpenApi(document) as JsonObject, entityPaths }, diagnostics: [] };
}
