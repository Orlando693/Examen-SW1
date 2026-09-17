import { execFile, spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { CanonicalUmlModel } from '@examen-sw1/uml-core';
import { mapCanonicalUmlModel, type RelationalGenerationMetadata } from '@examen-sw1/relational-core';
import { generateSpringProject } from '@examen-sw1/spring-generator';
import type { JsonObject, PostmanCollection, PostmanExecutionResult } from './types.js';

const execFileAsync = promisify(execFile);
const maxOutput = 8_192;

async function port(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => resolve()); });
  const address = server.address();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (!address || typeof address === 'string') throw new Error('Unable to allocate an isolated backend port.');
  return address.port;
}

async function requireJava21() {
  try {
    const { stdout } = await execFileAsync('java', ['--version'], { timeout: 30_000, windowsHide: true });
    if (!/^openjdk 21\./m.test(stdout)) throw new Error(`Java 21 is required; detected: ${stdout.trim()}`);
  } catch (error) {
    throw new Error(`Generated backend prerequisite failed: ${error instanceof Error ? error.message.slice(0, maxOutput) : String(error)}`);
  }
}

async function stop(child: ReturnType<typeof spawn>) {
  if (child.exitCode !== null || !child.pid) return;
  if (process.platform === 'win32') await execFileAsync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true }).catch(() => undefined);
  else child.kill('SIGTERM');
  if (child.exitCode === null) await new Promise<void>((resolve) => child.once('close', () => resolve()));
}

function start(root: string, backendPort: number): Promise<ReturnType<typeof spawn>> {
  const command = process.platform === 'win32' ? process.env.ComSpec ?? 'cmd.exe' : join(root, 'gradlew');
  const args = process.platform === 'win32' ? ['/d', '/c', 'call gradlew.bat --no-daemon bootRun'] : ['--no-daemon', 'bootRun'];
  const child = spawn(command, args, { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, SERVER_PORT: String(backendPort), SPRING_DATASOURCE_URL: 'jdbc:h2:mem:generated;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE', SPRING_DATASOURCE_USERNAME: 'sa', SPRING_DATASOURCE_PASSWORD: '', SPRING_JPA_HIBERNATE_DDL_AUTO: 'create-drop' } });
  return new Promise((resolve, reject) => {
    let output = '';
    const capture = (chunk: Buffer) => { output = `${output}${chunk.toString()}`.slice(-maxOutput); if (/Started GeneratedApplication/.test(output)) resolve(child); };
    child.stdout.on('data', capture);
    child.stderr.on('data', capture);
    child.once('error', (error) => reject(new Error(`Generated backend failed to start: ${error.message.slice(0, maxOutput)}`)));
    child.once('exit', (code) => reject(new Error(`Generated backend exited before readiness with code ${code}: ${output}`)));
  });
}

export async function withGeneratedOpenApi<T>(model: CanonicalUmlModel, metadata: RelationalGenerationMetadata, use: (input: { document: JsonObject; baseUrl: string; persistedOpenApiPath: string }) => Promise<T>): Promise<T> {
  const mapped = mapCanonicalUmlModel(model, metadata);
  if (!mapped.success) throw new Error(`Fixture mapping failed: ${mapped.diagnostics.map((item) => item.code).join(', ')}`);
  await requireJava21();
  const root = await mkdtemp(join(tmpdir(), 'generated-api-contracts-'));
  let child: ReturnType<typeof spawn> | undefined;
  try {
    const generated = await generateSpringProject(mapped.model, { outputRoot: root });
    if (generated.diagnostics.length || !generated.result) throw new Error(`Generated backend materialization failed: ${generated.diagnostics.map((item) => item.code).join(', ')}`);
    const backendPort = await port();
    child = await start(root, backendPort);
    const baseUrl = `http://127.0.0.1:${backendPort}`;
    const response = await fetch(`${baseUrl}/v3/api-docs`);
    if (!response.ok) throw new Error(`OpenAPI extraction failed with HTTP ${response.status}.`);
    const document = await response.json();
    if (!document || typeof document !== 'object' || Array.isArray(document)) throw new Error('OpenAPI extraction returned a non-object document.');
    const persistedOpenApiPath = join(root, 'openapi.json');
    await writeFile(persistedOpenApiPath, JSON.stringify(document));
    return await use({ document: document as JsonObject, baseUrl, persistedOpenApiPath });
  } finally {
    if (child) await stop(child);
    await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
}

function interpolate(value: string, variables: Map<string, string>) { return value.replace(/{{([^}]+)}}/g, (_, key: string) => variables.get(key) ?? ''); }

export async function executePostmanCollection(collection: PostmanCollection, baseUrl: string, include: (item: PostmanCollection['item'][number]) => boolean): Promise<PostmanExecutionResult[]> {
  const variables = new Map(collection.variable.map((item) => [item.key, item.value]));
  variables.set('baseUrl', baseUrl);
  const results: PostmanExecutionResult[] = [];
  for (const item of collection.item.filter(include)) {
    const response = await fetch(interpolate(item.request.url.raw, variables), { method: item.request.method, headers: Object.fromEntries(item.request.header.map((header) => [header.key, header.value])), body: item.request.body?.raw });
    results.push({ name: item.name, status: response.status });
    if (item.request.method === 'POST' && response.ok) {
      const body = await response.clone().json().catch(() => undefined) as { id?: string | number } | undefined;
      if (body?.id !== undefined) variables.set('resourceId', String(body.id));
    }
  }
  return results;
}
