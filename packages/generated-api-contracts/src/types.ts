export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export interface ContractDiagnostic {
  code: string;
  message: string;
  path: string;
}

export interface ValidatedOpenApiContract {
  document: JsonObject;
  entityPaths: string[];
}

export interface PostmanCollection {
  info: { name: string; schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' };
  variable: Array<{ key: string; value: string }>;
  item: PostmanItem[];
}

export interface PostmanItem {
  name: string;
  request: {
    method: string;
    header: Array<{ key: string; value: string }>;
    url: { raw: string; host: string[]; path: string[]; query?: Array<{ key: string; value: string }> };
    body?: { mode: 'raw'; raw: string; options: { raw: { language: 'json' } } };
  };
}

export interface PostmanExecutionResult {
  name: string;
  status: number;
}
