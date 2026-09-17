import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import Handlebars from 'handlebars';
import type { DomainManifest } from '@examen-sw1/domain-manifest';
import type { JsonObject, JsonValue, ValidatedOpenApiContract } from '@examen-sw1/generated-api-contracts';

export interface GeneratedFrontendFile { path: string; content: string; sha256: string; }
export interface FrontendGenerationDiagnostic { code: 'COLLIDING_OUTPUT_PATH' | 'UNSAFE_OUTPUT_PATH' | 'UNSTABLE_FILE_PLAN' | 'CONTRACT_MANIFEST_MISMATCH'; message: string; path: string; }
export interface FrontendGenerationResult { files: GeneratedFrontendFile[]; manifest: { algorithm: 'sha256'; files: Array<{ path: string; sha256: string }> }; diagnostics: FrontendGenerationDiagnostic[]; }
interface Operation { method: 'DELETE' | 'GET' | 'POST' | 'PUT'; path: string; query: string[]; }
type OperationMap = Record<string, Operation>;

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const compare = (left: string, right: string) => left.localeCompare(right, 'en');
const canonical = (value: unknown) => JSON.stringify(value, null, 2) + '\n';
const object = (value: JsonValue | undefined): value is JsonObject => typeof value === 'object' && value !== null && !Array.isArray(value);
const safePath = (path: string) => !isAbsolute(path) && path === path.replaceAll('\\', '/') && !path.split('/').some((part) => !part || part === '.' || part === '..');

const templates: Record<string, string> = {
  package: `{
  "name": "generated-web-frontend",
  "private": true,
  "version": "0.0.0",
  "scripts": { "dev": "next dev", "build": "next build", "test": "vitest run" },
  "allowScripts": { "@next/swc-win32-x64-msvc": true },
  "dependencies": {
    "@emotion/react": "11.14.0", "@emotion/styled": "11.14.1", "@mui/material": "7.3.11", "@mui/material-nextjs": "7.3.10", "next": "16.3.4", "react": "19.2.8", "react-dom": "19.2.8"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "6.9.1", "@testing-library/react": "16.3.2", "@types/node": "24.10.1", "@types/react": "19.2.7", "@types/react-dom": "19.2.3", "jsdom": "28.1.0", "typescript": "5.9.3", "vitest": "4.0.18"
  }
}
`,
  tsconfig: `{"compilerOptions":{"target":"ES2022","lib":["dom","dom.iterable","esnext"],"strict":true,"noEmit":true,"module":"esnext","moduleResolution":"bundler","jsx":"react-jsx","resolveJsonModule":true,"plugins":[{"name":"next"}]},"include":["next-env.d.ts","**/*.ts","**/*.tsx",".next/types/**/*.ts"],"exclude":["node_modules"]}
`,
  layout: `import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
export const metadata: Metadata = { title: 'Generated application', icons: { icon: '/favicon.svg' } };
export default function Layout({ children }: { children: ReactNode }) { return <html lang="en"><body><AppRouterCacheProvider>{children}</AppRouterCacheProvider></body></html>; }
`,
  page: `'use client';
import { GeneratedApp } from '../components/generated-app';
import type { DomainManifest } from '../lib/domain';
import type { OperationMap } from '../lib/contracts';
import manifest from '../generated/domain-manifest.json';
import operations from '../generated/operations.json';
export default function Page() { return <GeneratedApp manifest={manifest as DomainManifest} operations={operations as OperationMap} />; }
`,
  domain: `export type DomainField = { id: string; name: string; type: 'boolean' | 'date' | 'datetime' | 'decimal' | 'enum' | 'integer' | 'string'; nullable: boolean; generated: boolean; identifier: boolean; enumValues?: string[]; validations: string[]; searchable: boolean; sortable: boolean; filterable: boolean };
export type DomainEntity = { id: string; name: string; fields: DomainField[]; relationIds: string[]; crud: { create: boolean; read: boolean; update: boolean; delete: boolean; list: boolean; count: boolean }; pagination: boolean; filterFields: string[]; searchableFields: string[]; sortableFields: string[] };
export type DomainManifest = { version: 1; entities: DomainEntity[]; relations: unknown[] };
`,
  vitest: `import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'jsdom' } });
`,
  contracts: `export type Operation = { method: 'DELETE' | 'GET' | 'POST' | 'PUT'; path: string; query: string[] };
export type OperationMap = Record<string, Operation>;
export function interpolate(path: string, values: Record<string, string>) { return path.replace(/\\{([^}]+)\\}/g, (_, name: string) => values[name] ?? ''); }
export async function request(operations: OperationMap, key: string, values: Record<string, string> = {}, query: Record<string, string> = {}, body?: unknown) {
  const operation = operations[key];
  if (!operation) throw new Error('Unsupported contract operation: ' + key);
  const url = new URL(interpolate(operation.path, values), process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080');
  for (const [name, value] of Object.entries(query)) if (value && operation.query.includes(name)) url.searchParams.set(name, value);
   const requestBody = body && typeof body === 'object' && !Array.isArray(body) ? Object.fromEntries(Object.entries(body).map(([name, value]) => [name.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()), value])) : body;
   const response = await fetch(url, { method: operation.method, headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(requestBody) });
  if (!response.ok) throw new Error('Request failed: ' + response.status);
  return response.status === 204 ? undefined : response.json();
}
`,
  app: `'use client';
 import { useEffect, useRef, useState } from 'react';
import { Alert, AppBar, Box, Button, CircularProgress, Container, Drawer, FormControlLabel, IconButton, InputLabel, MenuItem, Paper, Select, Stack, Switch, TextField, Toolbar, Typography } from '@mui/material';
import type { DomainManifest } from '../lib/domain';
import type { OperationMap } from '../lib/contracts';
import { request } from '../lib/contracts';
type Props = { manifest: DomainManifest; operations: OperationMap };
type RecordValue = Record<string, unknown>;
const controls: Record<string, string> = { boolean: 'switch', date: 'date', datetime: 'datetime-local', decimal: 'number', integer: 'number', enum: 'select', string: 'text' };
function compatible(manifest: DomainManifest, operations: OperationMap) { return manifest.version === 1 && manifest.entities.every((entity) => Object.entries(entity.crud).filter(([, enabled]) => enabled).every(([name]) => operations[entity.id + ':' + name])); }
 function fields(entity: DomainManifest['entities'][number]) { return entity.fields.filter((field) => !field.generated); }
function maxLength(validations: string[]) { const value = validations.find((item) => item.startsWith('maxLength:')); return value ? Number(value.slice('maxLength:'.length)) : undefined; }
export function listQuery(entity: DomainManifest['entities'][number], page: number, search: string, sort: string, filters: Record<string, string>) { const sortField = sort.split(',')[0] ?? ''; return { page: String(page), size: '10', ...(entity.searchableFields.length && search ? { search } : {}), ...(entity.sortableFields.includes(sortField) ? { sort } : {}), ...Object.fromEntries(Object.entries(filters).filter(([name, value]) => entity.filterFields.includes(name) && value)) }; }
export function GeneratedApp({ manifest, operations }: Props) {
   const [entityId, setEntityId] = useState(manifest.entities[0]?.id ?? ''); const [rows, setRows] = useState<RecordValue[]>([]); const [selected, setSelected] = useState<RecordValue>(); const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list'); const [state, setState] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading'); const [error, setError] = useState(''); const [search, setSearch] = useState(''); const [sort, setSort] = useState(''); const [filters, setFilters] = useState<Record<string, string>>({}); const [page, setPage] = useState(0); const loadSequence = useRef(0);
  const entity = manifest.entities.find((item) => item.id === entityId);
   const load = async () => { if (!entity) return; const sequence = ++loadSequence.current; const query = listQuery(entity, page, search, sort, filters); setState('loading'); try { const result = await request(operations, entity.id + ':list', {}, query); if (sequence !== loadSequence.current) return; const content = Array.isArray(result) ? result : Array.isArray((result as RecordValue).content) ? (result as RecordValue).content as RecordValue[] : []; setRows(content); setState(content.length ? 'ready' : 'empty'); } catch (reason) { if (sequence !== loadSequence.current) return; setError(reason instanceof Error ? reason.message : 'Unable to load records.'); setState('error'); } };
  useEffect(() => { void load(); }, [entityId, page, search, sort]);
  if (!compatible(manifest, operations) || !entity) return <Container sx={{ py: 4 }}><Alert severity="error">Contract mismatch. No request was sent.</Alert></Container>; const selectEntity = (nextEntityId: string) => { setEntityId(nextEntityId); setPage(0); setSort(''); setSearch(''); setFilters({}); setSelected(undefined); setRows([]); setError(''); setMode('list'); };
   const id = entity.fields.find((field) => field.identifier)?.name ?? 'id'; const apiId = id.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
   const save = async (values: RecordValue) => { try { const key = mode === 'create' ? 'create' : 'update'; await request(operations, entity.id + ':' + key, mode === 'edit' ? { id: String(selected?.[id] ?? '') } : {}, {}, values); setMode('list'); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save record.'); setState('error'); } }; const remove = async (row: RecordValue) => { try { await request(operations, entity.id + ':delete', { id: String(row[id]) }); setSelected(undefined); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to delete record.'); setState('error'); } };
  return <Box sx={{ minHeight: '100vh', bgcolor: 'grey.100' }}><AppBar position="static"><Toolbar><Typography sx={{ flexGrow: 1 }}>Generated application</Typography><IconButton color="inherit" aria-label="open navigation" onClick={() => document.getElementById('entity-navigation')?.focus()}>Menu</IconButton></Toolbar></AppBar><Drawer variant="permanent" sx={{ display: { xs: 'none', md: 'block' }, '& .MuiDrawer-paper': { width: 240, pt: 8 } }}><Stack id="entity-navigation" tabIndex={-1} spacing={1} sx={{ p: 2 }}>{manifest.entities.map((item) => <Button key={item.id} variant={item.id === entityId ? 'contained' : 'text'} onClick={() => { setEntityId(item.id); setMode('list'); }}>{item.name}</Button>)}</Stack></Drawer><Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 }, ml: { md: '240px' } }}><Stack spacing={2}><Typography variant="h4">{entity.name}</Typography>{state === 'error' && <Alert severity="error">{error}</Alert>}{mode === 'list' ? <><Paper sx={{ p: 2 }}><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><TextField label="Search" value={search} onChange={(event) => { setPage(0); setSearch(event.target.value); }} /><Select displayEmpty value={sort} onChange={(event) => setSort(String(event.target.value))}><MenuItem value="">No sort</MenuItem>{entity.sortableFields.map((field) => <MenuItem key={field} value={field}>{field}</MenuItem>)}</Select>{entity.crud.create && <Button variant="contained" onClick={() => setMode('create')}>Create</Button>}</Stack></Paper>{state === 'loading' && <CircularProgress aria-label="Loading" />}{state === 'empty' && <Alert severity="info">No {entity.name} records.</Alert>}{state === 'ready' && <Stack>{rows.map((row, index) => <Paper key={String(row[id] ?? index)} sx={{ p: 2, mb: 1 }}><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><Typography sx={{ flexGrow: 1 }}>{String(row[id] ?? index)}</Typography>{entity.crud.read && <Button onClick={() => setSelected(row)}>Details</Button>}{entity.crud.update && <Button onClick={() => { setSelected(row); setMode('edit'); }}>Edit</Button>}{entity.crud.delete && <Button color="error" onClick={() => void request(operations, entity.id + ':delete', { id: String(row[id]) }).then(load).catch((reason: unknown) => { setError(reason instanceof Error ? reason.message : 'Unable to delete record.'); setState('error'); })}>Delete</Button>}</Stack></Paper>)}</Stack>}<Stack direction="row" spacing={1}><Button disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button><Button onClick={() => setPage(page + 1)}>Next</Button></Stack></> : <EntityForm entity={entity} initial={mode === 'edit' ? selected : undefined} onCancel={() => setMode('list')} onSave={save} />}{selected && mode === 'list' && <Detail entity={entity} record={selected} operations={operations} onClose={() => setSelected(undefined)} />}</Stack></Container></Box>;
}
function EntityForm({ entity, initial, onCancel, onSave }: { entity: DomainManifest['entities'][number]; initial?: RecordValue; onCancel(): void; onSave(values: RecordValue): void }) { const [values, setValues] = useState<RecordValue>(initial ?? {}); const [validation, setValidation] = useState(''); const submit = () => { for (const field of fields(entity)) { if (field.validations.includes('required') && (values[field.name] === undefined || values[field.name] === '')) return setValidation(field.name + ' is required.'); const limit = maxLength(field.validations); if (limit && String(values[field.name] ?? '').length > limit) return setValidation(field.name + ' exceeds maximum length.'); } onSave(values); }; return <Paper component="form" onSubmit={(event) => { event.preventDefault(); submit(); }} sx={{ p: 2 }}><Stack spacing={2}><Typography variant="h6">{initial ? 'Edit' : 'Create'} {entity.name}</Typography>{validation && <Alert severity="warning">{validation}</Alert>}{fields(entity).map((field) => field.type === 'boolean' ? <FormControlLabel key={field.id} label={field.name} control={<Switch checked={Boolean(values[field.name])} onChange={(event) => setValues({ ...values, [field.name]: event.target.checked })} />} /> : field.type === 'enum' ? <><InputLabel key={field.id + '-label'}>{field.name}</InputLabel><Select key={field.id} value={String(values[field.name] ?? '')} onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}>{field.enumValues?.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</Select></> : <TextField key={field.id} label={field.name} required={field.validations.includes('required')} type={controls[field.type]} multiline={field.validations.includes('multiline')} inputProps={{ maxLength: maxLength(field.validations) }} value={String(values[field.name] ?? '')} onChange={(event) => setValues({ ...values, [field.name]: event.target.value })} />)}<Stack direction="row" spacing={1}><Button type="submit" variant="contained">Save</Button><Button onClick={onCancel}>Cancel</Button></Stack></Stack></Paper>; }
function Detail({ entity, record, operations, onClose }: { entity: DomainManifest['entities'][number]; record: RecordValue; operations: OperationMap; onClose(): void }) { const id = entity.fields.find((field) => field.identifier)?.name ?? 'id'; const [relations, setRelations] = useState<Record<string, unknown>>({}); return <Paper sx={{ p: 2 }}><Stack spacing={1}><Typography variant="h6">Details</Typography>{Object.entries(record).map(([name, value]) => <Typography key={name}>{name}: {String(value)}</Typography>)}{entity.relationIds.map((relation) => <Button key={relation} onClick={() => void request(operations, entity.id + ':relationships', { id: String(record[id]), relationship: relation }).then((value) => setRelations({ ...relations, [relation]: value }))}>Open relation {relation}</Button>)}{Object.keys(relations).map((name) => <Typography key={name}>Relation {name} loaded</Typography>)}<Button onClick={onClose}>Close</Button></Stack></Paper>; }
`,
  test: `import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GeneratedApp, listQuery } from '../components/generated-app';
import type { DomainManifest } from '../lib/domain';
import type { OperationMap } from '../lib/contracts';
import manifest from '../generated/domain-manifest.json';
import operations from '../generated/operations.json';
describe('generated application', () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
  it('blocks incompatible contract mappings before network access', () => { const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher); render(<GeneratedApp manifest={manifest as DomainManifest} operations={{}} />); expect(screen.getByText(/Contract mismatch/)).toBeInTheDocument(); expect(fetcher).not.toHaveBeenCalled(); });
  it('uses the declared list operation through responsive navigation', async () => { const calls: Array<{ method?: string }> = []; vi.stubGlobal('fetch', vi.fn(async (_input, init?: RequestInit) => { calls.push({ method: init?.method }); return { ok: true, status: 200, json: async () => ({ content: [] }) }; })); render(<GeneratedApp manifest={manifest as DomainManifest} operations={operations as OperationMap} />); expect(screen.getByLabelText('open navigation')).toBeInTheDocument(); await waitFor(() => expect(calls).toHaveLength(1)); });
  it('resets entity-specific query state and never forwards an undeclared sort', () => { const source = (manifest as DomainManifest).entities.find((item) => item.sortableFields.length > 0); const sortField = source?.sortableFields[0]; const target = (manifest as DomainManifest).entities.find((item) => item.id !== source?.id && !item.sortableFields.includes(sortField ?? '')); if (!source || !sortField || !target) throw new Error('Known fixture requires entities with incompatible declared sorting.'); expect(listQuery(source, 2, 'query', sortField + ',asc', { [sortField]: 'value' })).toMatchObject({ page: '2', search: 'query', sort: sortField + ',asc' }); expect(listQuery(target, 0, '', '', {})).toEqual({ page: '0', size: '10' }); expect(listQuery(target, 0, 'query', sortField + ',asc', { [sortField]: 'value' })).toEqual({ page: '0', size: '10' }); });
});
`,
};

// React object literals use `{{` extensively. Escape them before compilation so the
// registry still owns rendering without treating JSX as Handlebars expressions.
const registry = Object.fromEntries(Object.entries(templates).map(([name, source]) => [name, Handlebars.compile(source.replaceAll('{{', '\\{{'), { noEscape: true, preventIndent: true })]));
function render(name: keyof typeof templates): string {
  const output = registry[name]({}).trimEnd();
  if (name !== 'app') return output + '\n';
  return output
    .replace("const [entityId, setEntityId] = useState(manifest.entities[0]?.id ?? '');", "const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false); const [entityId, setEntityId] = useState(manifest.entities[0]?.id ?? '');")
    .replace("onClick={() => document.getElementById('entity-navigation')?.focus()}", "onClick={() => setMobileNavigationOpen(true)}")
    .replace('<Drawer variant="permanent" sx={{ display: { xs: \'none\', md: \'block\' }, \'& .MuiDrawer-paper\': { width: 240, pt: 8 } }}>', '<Drawer variant={mobileNavigationOpen ? \'temporary\' : \'permanent\'} open={mobileNavigationOpen} onClose={() => setMobileNavigationOpen(false)} sx={{ display: { xs: mobileNavigationOpen ? \'block\' : \'none\', md: \'block\' }, \'& .MuiDrawer-paper\': { width: 240, pt: 8 } }}>')
    .replace('</Select>{entity.crud.create && <Button variant="contained" onClick={() => setMode(\'create\')}>Create</Button>}</Stack></Paper>{state', '</Select>{entity.crud.create && <Button variant="contained" onClick={() => setMode(\'create\')}>Create</Button>}<Button disabled={page === 0} onClick={() => setPage(page - 1)}>Previous page</Button><Button onClick={() => setPage(page + 1)}>Next page</Button></Stack></Paper>{state')
    .replace('value={field}>{field}</MenuItem>', "value={field + ',asc'}>{field}</MenuItem>")
    .replace("const id = entity.fields.find((field) => field.identifier)?.name ?? 'id'; const save", "const id = entity.fields.find((field) => field.identifier)?.name ?? 'id'; const apiId = id.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()); const save")
    .replace("const id = entity.fields.find((field) => field.identifier)?.name ?? 'id'; const [relations", "const id = entity.fields.find((field) => field.identifier)?.name ?? 'id'; const apiId = id.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()); const [relations")
    .replace("onClick={() => void request(operations, entity.id + ':delete', { id: String(row[id]) }).then(load).catch(() => setState('error'))}", "onClick={() => void remove(row)}")
    .replaceAll('row[id]', 'row[apiId]')
    .replaceAll('selected?.[id]', 'selected?.[apiId]')
    .replaceAll('record[id]', 'record[apiId]')
    .replace("onSave(values); }; return", "onSave(Object.fromEntries(Object.entries(values).filter(([, value]) => value !== ''))); }; return")
    .replace("onClick={() => { setEntityId(item.id); setMode('list'); }}", "onClick={() => { selectEntity(item.id); setMobileNavigationOpen(false); }}") + '\n';
}

function deriveOperations(domain: DomainManifest, contract: ValidatedOpenApiContract): { map?: OperationMap; diagnostics: FrontendGenerationDiagnostic[] } {
  const paths = contract.document.paths;
  if (!object(paths)) return { diagnostics: [{ code: 'CONTRACT_MANIFEST_MISMATCH', message: 'Validated contract does not contain paths.', path: 'contract.paths' }] };
  const map: OperationMap = {};
  const required = { list: 'get', create: 'post', read: 'get', update: 'put', delete: 'delete', count: 'get', relationships: 'get' } as const;
  for (const entity of domain.entities) {
    const base = contract.entityPaths.find((path) => path.split('/').at(-1) === entity.name);
    if (!base) return { diagnostics: [{ code: 'CONTRACT_MANIFEST_MISMATCH', message: 'No OpenAPI entity path matches the declared manifest entity.', path: `manifest.entities.${entity.id}` }] };
    const pathsByOperation = { list: base, create: base, read: `${base}/{id}`, update: `${base}/{id}`, delete: `${base}/{id}`, count: `${base}/count`, relationships: `${base}/{id}/relationships/{relationship}` } as const;
    for (const [name, method] of Object.entries(required) as Array<[keyof typeof required, 'get' | 'post' | 'put' | 'delete']>) {
      if (name !== 'relationships' && !entity.crud[name as keyof typeof entity.crud]) continue;
      const path = pathsByOperation[name]; const item = paths[path]; const operation = object(item) && object(item[method]) ? item[method] : undefined;
      if (!operation) return { diagnostics: [{ code: 'CONTRACT_MANIFEST_MISMATCH', message: 'A declared manifest capability has no OpenAPI operation.', path: `contract.paths.${path}.${method}` }] };
      const parameters = Array.isArray(operation.parameters) ? operation.parameters : [];
      map[`${entity.id}:${name}`] = { method: method.toUpperCase() as Operation['method'], path, query: parameters.filter(object).filter((parameter) => parameter.in === 'query' && typeof parameter.name === 'string').map((parameter) => parameter.name as string).sort(compare) };
    }
  }
  return { map: Object.fromEntries(Object.entries(map).sort(([left], [right]) => compare(left, right))), diagnostics: [] };
}

function planFile(files: GeneratedFrontendFile[], path: string, content: string, diagnostics: FrontendGenerationDiagnostic[]) {
  if (!safePath(path)) { diagnostics.push({ code: 'UNSAFE_OUTPUT_PATH', message: 'Generated paths must be safe relative POSIX paths.', path }); return; }
  if (files.some((file) => file.path === path)) { diagnostics.push({ code: 'COLLIDING_OUTPUT_PATH', message: 'Generated paths must be unique.', path }); return; }
  files.push({ path, content, sha256: hash(content) });
}

export async function writeGeneratedFrontendFiles(outputRoot: string, files: GeneratedFrontendFile[]): Promise<FrontendGenerationDiagnostic[]> {
  const root = resolve(outputRoot); const seen = new Set<string>();
  for (const file of files) { const destination = resolve(root, file.path); if (!safePath(file.path) || seen.has(file.path) || relative(root, destination).startsWith('..')) return [{ code: seen.has(file.path) ? 'COLLIDING_OUTPUT_PATH' : 'UNSAFE_OUTPUT_PATH', message: 'Generated files must remain unique and below the output root.', path: file.path }]; seen.add(file.path); }
  for (const file of files) { const destination = resolve(root, file.path); await mkdir(dirname(destination), { recursive: true }); await writeFile(destination, file.content); }
  return [];
}

export async function generateFrontendProject(domain: DomainManifest, contract: ValidatedOpenApiContract, outputRoot?: string): Promise<FrontendGenerationResult> {
  const derived = deriveOperations(domain, contract); if (!derived.map) return { files: [], manifest: { algorithm: 'sha256', files: [] }, diagnostics: derived.diagnostics };
  const diagnostics: FrontendGenerationDiagnostic[] = []; const files: GeneratedFrontendFile[] = [];
  for (const [path, template] of [['package.json', 'package'], ['tsconfig.json', 'tsconfig'], ['next-env.d.ts', 'next-env.d.ts'], ['vitest.config.ts', 'vitest'], ['app/layout.tsx', 'layout'], ['app/page.tsx', 'page'], ['components/generated-app.tsx', 'app'], ['lib/contracts.ts', 'contracts'], ['lib/domain.ts', 'domain'], ['test/generated-app.test.tsx', 'test']] as const) planFile(files, path, template === 'next-env.d.ts' ? '/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n' : render(template), diagnostics);
  planFile(files, 'public/favicon.svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#0d47a1"/><path fill="#fff" d="M8 8h16v4H12v8h12v4H8z"/></svg>\n', diagnostics);
  planFile(files, 'generated/domain-manifest.json', canonical(domain), diagnostics); planFile(files, 'generated/operations.json', canonical(derived.map), diagnostics);
  files.sort((left, right) => compare(left.path, right.path));
  if (files.some((file, index) => index > 0 && files[index - 1]!.path >= file.path)) diagnostics.push({ code: 'UNSTABLE_FILE_PLAN', message: 'Canonical file plan is not strictly ordered.', path: 'files' });
  if (diagnostics.length) return { files: [], manifest: { algorithm: 'sha256', files: [] }, diagnostics };
  if (outputRoot) { const writeDiagnostics = await writeGeneratedFrontendFiles(outputRoot, files); if (writeDiagnostics.length) return { files: [], manifest: { algorithm: 'sha256', files: [] }, diagnostics: writeDiagnostics }; }
  return { files, manifest: { algorithm: 'sha256', files: files.map(({ path, sha256 }) => ({ path, sha256 })) }, diagnostics: [] };
}
