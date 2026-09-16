import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { CanonicalUmlModel } from '@examen-sw1/uml-core';
import { mapCanonicalUmlModel } from '@examen-sw1/relational-core';
import type { RelationalGenerationMetadata } from '@examen-sw1/relational-core';
import { generateSpringProject } from './generator.js';

const execFileAsync = promisify(execFile);
const WRAPPER_SHA256 = '423cb469ccc0ecc31f0e4e1c309976198ccb734cdcbb7029d4bda0f18f57e8d9';

async function command(command: string, args: string[], cwd?: string) {
  try {
    const wrapper = process.platform === 'win32' && command.endsWith('.bat');
    return await execFileAsync(wrapper ? (process.env.ComSpec ?? 'cmd.exe') : command, wrapper ? ['/d', '/c', `call gradlew.bat ${args.join(' ')}`] : args, { cwd, timeout: 180_000, maxBuffer: 256 * 1024, windowsHide: true });
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string; message: string };
    throw new Error(`${command} ${args.join(' ')} failed: ${(failure.stderr ?? failure.stdout ?? failure.message).slice(0, 8192)}`);
  }
}

export async function verifyGeneratedProject(model: CanonicalUmlModel, metadata: RelationalGenerationMetadata = {}): Promise<void> {
  const mapped = mapCanonicalUmlModel(model, metadata);
  if (!mapped.success) throw new Error(`Fixture mapping failed: ${mapped.diagnostics.map((item) => item.code).join(', ')}`);
  const root = await mkdtemp(join(tmpdir(), 'spring-generator-harness-'));
  try {
    const [first, second] = await Promise.all([generateSpringProject(mapped.model, { outputRoot: join(root, 'first') }), generateSpringProject(mapped.model, { outputRoot: join(root, 'second') })]);
    if (first.diagnostics.length || second.diagnostics.length || !first.result || !second.result) throw new Error('Generation produced diagnostics.');
    if (JSON.stringify(first.result.manifest) !== JSON.stringify(second.result.manifest)) throw new Error('Regeneration is not deterministic.');
    const wrapper = first.files.find((file) => file.path === 'gradle/wrapper/gradle-wrapper.jar');
    if (!wrapper || createHash('sha256').update(wrapper.content).digest('hex') !== WRAPPER_SHA256) throw new Error('Generated Gradle Wrapper JAR is missing or does not match Gradle 9.2.0.');
    const java = await command('java', ['--version']);
    if (!/^openjdk 21\./m.test(java.stdout)) throw new Error(`Java 21 is required; detected: ${java.stdout.trim()}`);
    await command(join(root, 'first', 'gradlew.bat'), ['--no-daemon', 'test'], join(root, 'first'));
    await command(join(root, 'first', 'gradlew.bat'), ['--no-daemon', 'build'], join(root, 'first'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
