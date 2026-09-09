import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL must be defined for integration migrations.');
}

const url = new URL(testDatabaseUrl);
if (url.protocol !== 'postgresql:' || url.hostname !== 'localhost' || url.port !== '5432' || url.pathname !== '/examen_sw1_test') {
  throw new Error('TEST_DATABASE_URL must target the isolated local integration database.');
}

const prismaCli = fileURLToPath(new URL('../../node_modules/prisma/build/index.js', import.meta.url));
const result = spawnSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
  cwd: new URL('..', import.meta.url),
  env: { ...process.env, DATABASE_URL: testDatabaseUrl },
  stdio: 'inherit',
});

if (result.error) {
  throw result.error;
}

process.exitCode = result.status ?? 1;
