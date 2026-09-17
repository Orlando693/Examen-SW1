import { execFile, spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { chromium, expect as browserExpect, type Browser, type Page, type Request } from '@playwright/test';
import { describe, expect, it } from 'vitest';
import { generateDomainManifest } from '@examen-sw1/domain-manifest';
import { mapCanonicalUmlModel } from '@examen-sw1/relational-core';
import { validateGeneratedOpenApi, withGeneratedOpenApi } from '@examen-sw1/generated-api-contracts';
import { knownCanonicalFixture, knownFixtureMetadata } from '../../spring-generator/test/known-canonical-fixture.js';
import { generateFrontendProject } from '../src/index.js';

const exec = promisify(execFile);
const maxOutput = 8_192;
const isVerifiedNoContentDeleteAbort = (request: Request, expected: Request | undefined, completedDeletes: WeakSet<Request>) => request === expected && request.method() === 'DELETE' && request.failure()?.errorText === 'net::ERR_ABORTED' && completedDeletes.has(request);

async function reservePort() {
  const server = createServer();
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (!address || typeof address === 'string') throw new Error('Unable to reserve a frontend port.');
  return address.port;
}

async function runNpm(args: string[], cwd: string, env: NodeJS.ProcessEnv = process.env) {
  const command = process.platform === 'win32' ? process.env.ComSpec ?? 'cmd.exe' : 'npm';
  const commandArgs = process.platform === 'win32' ? ['/d', '/c', `npm ${args.join(' ')}`] : args;
  const childEnv = { ...env };
  delete childEnv.npm_config_allow_scripts;
  delete childEnv.NPM_CONFIG_ALLOW_SCRIPTS;
  return exec(command, commandArgs, { cwd, env: childEnv, timeout: 600_000, windowsHide: true });
}

async function startNext(root: string, port: number, backendUrl: string) {
  const command = process.platform === 'win32' ? process.env.ComSpec ?? 'cmd.exe' : 'npm';
  const args = process.platform === 'win32' ? ['/d', '/c', `npm run dev -- --hostname 127.0.0.1 --port ${port}`] : ['run', 'dev', '--', '--hostname', '127.0.0.1', '--port', String(port)];
  const child = spawn(command, args, { cwd: root, env: { ...process.env, NEXT_PUBLIC_API_BASE_URL: backendUrl }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let output = '';
  const capture = (chunk: Buffer) => { output = `${output}${chunk}`.slice(-maxOutput); };
  child.stdout.on('data', capture);
  child.stderr.on('data', capture);
  const url = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Generated Next.js exited before readiness: ${output}`);
    try { if ((await fetch(url)).ok) return { child, url }; } catch { /* wait for Next.js */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Generated Next.js did not become ready: ${output}`);
}

async function stop(child: ReturnType<typeof spawn>) {
  if (child.exitCode !== null || !child.pid) return;
  if (process.platform === 'win32') await exec('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true }).catch(() => undefined);
  else child.kill('SIGTERM');
}

async function createProduct(page: Page, sku: string) {
  await page.getByRole('button', { name: 'Product' }).click();
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByLabel('sku').fill(sku);
  await page.getByRole('button', { name: 'Save' }).click();
  await browserExpect(page.getByRole('button', { name: 'Details' })).toBeVisible();
}

describe('generated frontend real browser', () => {
  it('only normalizes the verified Chromium DELETE 204 abort', () => {
    const completedDeletes = new WeakSet<Request>();
    const request = { method: () => 'DELETE', failure: () => ({ errorText: 'net::ERR_ABORTED' }) } as unknown as Request;
    completedDeletes.add(request);
    expect(isVerifiedNoContentDeleteAbort(request, request, completedDeletes)).toBe(true);
    expect(isVerifiedNoContentDeleteAbort({ method: () => 'GET', failure: () => ({ errorText: 'net::ERR_ABORTED' }) } as unknown as Request, request, completedDeletes)).toBe(false);
    expect(isVerifiedNoContentDeleteAbort({ method: () => 'DELETE', failure: () => ({ errorText: 'net::ERR_ABORTED' }) } as unknown as Request, request, completedDeletes)).toBe(false);
    expect(isVerifiedNoContentDeleteAbort(request, undefined, completedDeletes)).toBe(false);
  });
  it('operates the known generated application against its real Spring backend', async () => {
    const mapped = mapCanonicalUmlModel(knownCanonicalFixture, knownFixtureMetadata);
    expect(mapped.success).toBe(true);
    if (!mapped.success) return;
    await withGeneratedOpenApi(knownCanonicalFixture, knownFixtureMetadata, async ({ document, baseUrl }) => {
      const validated = validateGeneratedOpenApi(document);
      expect(validated.diagnostics).toEqual([]);
      if (!validated.contract) throw new Error('The generated backend did not expose a valid contract.');
      const manifest = generateDomainManifest(mapped.model, validated.contract).manifest;
      if (!manifest) throw new Error('The generated backend contract did not produce a domain manifest.');
      const root = await mkdtemp(join(tmpdir(), 'frontend-generator-browser-'));
      let next: Awaited<ReturnType<typeof startNext>> | undefined;
      let browser: Browser | undefined;
      try {
        expect((await generateFrontendProject(manifest, validated.contract, root)).diagnostics).toEqual([]);
        await runNpm(['install'], root);
        next = await startNext(root, await reservePort(), baseUrl);
        browser = await chromium.launch({ channel: 'chrome' });
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        const consoleErrors: string[] = [];
        const pageErrors: string[] = [];
        const requestFailures: Array<{ request: Request; message: string }> = [];
        const deleteEvents: string[] = [];
        const completedDeletes = new WeakSet<Request>();
        const apiRequests: string[] = [];
        const apiFailures: string[] = [];
        page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
        page.on('pageerror', (error) => pageErrors.push(error.message));
        page.on('requestfailed', (request) => { const event = `${request.method()} ${request.url()}: ${request.failure()?.errorText ?? 'unknown failure'}`; requestFailures.push({ request, message: event }); if (request.method() === 'DELETE') deleteEvents.push(`failed ${event}`); });
        page.on('request', (request) => { if (request.url().startsWith(`${baseUrl}/api/`)) apiRequests.push(request.url()); if (request.method() === 'DELETE') deleteEvents.push(`request ${request.url()}`); });
        page.on('response', (response) => { if (response.request().method() === 'DELETE') { deleteEvents.push(`response ${response.status()} ${response.url()}`); if (response.status() === 204) completedDeletes.add(response.request()); } });
        page.on('response', (response) => { if (response.url().startsWith(`${baseUrl}/api/`) && response.status() >= 400) apiFailures.push(`${response.status()} ${response.url()}`); });

        await page.route(`${baseUrl}/api/customer?*`, async (route) => { await new Promise((resolve) => setTimeout(resolve, 500)); await route.continue(); });
        await page.goto(next.url, { waitUntil: 'domcontentloaded' });
        await browserExpect(page.getByRole('heading', { name: 'Customer' })).toBeVisible();
        await browserExpect(page.getByLabel('Loading')).toBeVisible();
        await browserExpect(page.getByText('No Customer records.')).toBeVisible({ timeout: 30_000 });
        await page.unroute(`${baseUrl}/api/customer?*`);
        await page.getByRole('button', { name: 'Product' }).click();
        await browserExpect(page.getByRole('heading', { name: 'Product' })).toBeVisible();

        const sku = `browser-${Date.now()}`;
        await createProduct(page, sku);
        await page.getByRole('button', { name: 'Details' }).click();
        await browserExpect(page.getByText(`sku: ${sku}`)).toBeVisible();
        await browserExpect(page.getByRole('button', { name: /Open relation/ }).first()).toBeVisible();
        await page.getByRole('button', { name: 'Close' }).click();
        await page.getByLabel('Search').fill('browser');
        await browserExpect.poll(() => apiRequests.some((url) => url.includes('search=browser'))).toBe(true);
        await page.getByLabel('Search').fill('');
        await page.getByRole('combobox').click();
        await page.getByRole('option', { name: 'sku' }).click();
        await browserExpect.poll(() => apiRequests.some((url) => url.includes('sort=sku'))).toBe(true);
        await page.getByRole('button', { name: 'Next page' }).click();
        await browserExpect.poll(() => apiRequests.some((url) => url.includes('page=1'))).toBe(true);
        await page.getByRole('button', { name: 'Previous page' }).click();
        await browserExpect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
        await page.getByRole('button', { name: 'Edit' }).click();
        await page.getByLabel('sku').fill(`${sku}-updated`);
        await page.getByRole('button', { name: 'Save' }).click();
        await page.getByRole('button', { name: 'Details' }).click();
        await browserExpect(page.getByText(`sku: ${sku}-updated`)).toBeVisible();
        await page.getByRole('button', { name: 'Close' }).click();
        const deleteResponse = page.waitForResponse((response) => response.request().method() === 'DELETE' && response.url().startsWith(`${baseUrl}/api/product/`));
        await page.getByRole('button', { name: 'Delete' }).click();
        const observedDelete = await deleteResponse; expect(observedDelete.status()).toBe(204); const expectedDelete = observedDelete.request();
        await browserExpect(page.getByText('No Product records.')).toBeVisible();

        await page.route(`${baseUrl}/api/product?*`, (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }));
        await page.getByRole('button', { name: /^customer$/i }).click();
        await page.getByRole('button', { name: 'Product' }).click();
        await browserExpect(page.getByText('Request failed: 500')).toBeVisible();
        await page.unroute(`${baseUrl}/api/product?*`);

        await page.setViewportSize({ width: 390, height: 844 });
        await page.getByRole('button', { name: 'open navigation' }).click();
        await browserExpect(page.getByRole('presentation')).toBeVisible();
        await page.getByRole('button', { name: 'Product' }).last().click();
        await browserExpect(page.getByRole('heading', { name: 'Product' })).toBeVisible();
        await page.setViewportSize({ width: 768, height: 1024 });
        expect(await page.locator('body').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
        await page.setViewportSize({ width: 1440, height: 900 });
        await browserExpect(page.getByRole('button', { name: 'Product' })).toBeVisible();

        expect(pageErrors).toEqual([]);
        expect(apiFailures).toEqual([expect.stringMatching(/^500 /)]);
        expect(consoleErrors.filter((error) => !error.includes('500'))).toEqual([]);
        // Chromium can emit ERR_ABORTED after Playwright observed a DELETE 204 response.
        const unexpectedFailures = requestFailures.filter(({ request }) => !isVerifiedNoContentDeleteAbort(request, expectedDelete, completedDeletes));
        if (unexpectedFailures.length) throw new Error(`Unexpected browser request failures: ${unexpectedFailures.map(({ message }) => message).join(' | ')}; delete sequence: ${deleteEvents.join(' | ')}`);
      } finally {
        if (browser) await browser.close();
        if (next) await stop(next.child);
        await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
      }
    });
  }, 1_200_000);
});
