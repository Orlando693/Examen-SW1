import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { mapCanonicalUmlModel } from '@examen-sw1/relational-core';
import { validateGeneratedOpenApi, withGeneratedOpenApi } from '@examen-sw1/generated-api-contracts';
import { generateDomainManifest } from '@examen-sw1/domain-manifest';
import { generateFrontendProject, writeGeneratedFrontendFiles } from '../src/index.js';
import { knownCanonicalFixture, knownFixtureMetadata } from '../../spring-generator/test/known-canonical-fixture.js';

const exec = promisify(execFile);
async function runNpm(args: string[], cwd: string) { const env = { ...process.env }; delete env.npm_config_allow_scripts; delete env.NPM_CONFIG_ALLOW_SCRIPTS; const command = process.platform === 'win32' ? process.env.ComSpec ?? 'cmd.exe' : 'npm'; const commandArgs = process.platform === 'win32' ? ['/d', '/c', `npm ${args.join(' ')}`] : args; try { return await exec(command, commandArgs, { cwd, timeout: 600_000, windowsHide: true, env }); } catch (error) { const failure = error as Error & { code?: number | string; stdout?: string; stderr?: string }; const output = [failure.stdout, failure.stderr].filter(Boolean).join('\n').slice(-8_192); throw new Error(`Command failed (exit ${failure.code ?? 'unknown'}): npm ${args.join(' ')}\ncwd: ${cwd}\n${output}`); } }
describe('generateFrontendProject', () => {
  it('creates a deterministic, contract-only executable application', async () => {
    const mapped = mapCanonicalUmlModel(knownCanonicalFixture, knownFixtureMetadata); expect(mapped.success).toBe(true); if (!mapped.success) return;
    await withGeneratedOpenApi(knownCanonicalFixture, knownFixtureMetadata, async ({ document }) => {
      const contract = validateGeneratedOpenApi(document).contract; expect(contract).toBeDefined(); if (!contract) return;
      const domain = generateDomainManifest(mapped.model, contract).manifest; expect(domain).toBeDefined(); if (!domain) return;
      const root = await mkdtemp(join(tmpdir(), 'frontend-generator-'));
      try { const first = await generateFrontendProject(domain, contract, join(root, 'first')); const second = await generateFrontendProject(domain, contract, join(root, 'second')); expect(first.diagnostics).toEqual([]); expect(first.manifest).toEqual(second.manifest); expect(first.files.map((file) => file.path)).toEqual([...first.files.map((file) => file.path)].sort()); expect(await readFile(join(root, 'first', 'lib', 'contracts.ts'), 'utf8')).not.toMatch(/@examen-sw1|CanonicalUml|\/api\//); await expect(writeGeneratedFrontendFiles(join(root, 'unsafe'), [{ path: '../escape', content: '', sha256: '' }])).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ code: 'UNSAFE_OUTPUT_PATH' })])); await expect(writeGeneratedFrontendFiles(join(root, 'collision'), [{ path: 'safe.txt', content: '', sha256: '' }, { path: 'safe.txt', content: '', sha256: '' }])).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ code: 'COLLIDING_OUTPUT_PATH' })])); const incompatible = await generateFrontendProject(domain, { ...contract, entityPaths: [] }); expect(incompatible.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'CONTRACT_MANIFEST_MISMATCH' })])); await runNpm(['install'], join(root, 'first')); await runNpm(['run', 'test'], join(root, 'first')); await runNpm(['run', 'build'], join(root, 'first')); } finally { await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); }
    });
  }, 1_200_000);
});
