import process from 'node:process';

const required = ['DATABASE_URL', 'TEST_DATABASE_URL'];

for (const name of required) {
  if (!process.env[name]) throw new Error(`${name} must be configured for CASE E2E.`);
}
if (process.env.DATABASE_URL === process.env.TEST_DATABASE_URL) {
  throw new Error('DATABASE_URL and TEST_DATABASE_URL must be distinct for CASE E2E.');
}
if (process.env.ASSISTANT_PROVIDER !== 'deterministic' || process.env.NODE_ENV !== 'test') {
  throw new Error('CASE E2E requires explicit ASSISTANT_PROVIDER=deterministic and NODE_ENV=test.');
}
if (process.env.LOCAL_LLM_MODEL_PATH) throw new Error('CASE E2E must not configure LOCAL_LLM_MODEL_PATH.');
