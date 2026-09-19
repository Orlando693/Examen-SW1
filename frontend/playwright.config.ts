import { defineConfig } from '@playwright/test';

const databaseUrl = process.env.DATABASE_URL;
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:3100', trace: 'retain-on-failure' },
  webServer: [
    {
      command: 'npm run e2e:backend --workspace frontend',
      cwd: '..',
      url: 'http://127.0.0.1:3101/health',
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        BACKEND_PORT: '3101',
        FRONTEND_ORIGIN: 'http://127.0.0.1:3100',
        DATABASE_URL: databaseUrl ?? '',
        TEST_DATABASE_URL: testDatabaseUrl ?? '',
        ASSISTANT_PROVIDER: 'deterministic',
        LOCAL_LLM_MODEL_PATH: '',
        JWT_SECRET: 'case-e2e-only-secret-that-is-long-enough',
      },
    },
    {
      command: 'npm run e2e:frontend --workspace frontend',
      cwd: '..',
      url: 'http://127.0.0.1:3100/login',
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...process.env,
        NEXT_PUBLIC_API_BASE_URL: 'http://127.0.0.1:3101',
        NEXT_PUBLIC_REALTIME_URL: 'http://127.0.0.1:3101',
      },
    },
  ],
});
