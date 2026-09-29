import { defineConfig } from 'vitest/config';

// Tests run against a real Postgres database (not mocks), because the things
// most worth testing - capacity, concurrency, constraints - live in the DB.
// Point TEST_DATABASE_URL at an empty database; it is wiped between tests.
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/teslapool_test';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: './test/global-setup.js',
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: TEST_DATABASE_URL,
      JWT_SECRET: 'test-secret-test-secret-test-secret-123',
      LOG_LEVEL: 'silent',
    },
    // One database, so test files run one after another.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
