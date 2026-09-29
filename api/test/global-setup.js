import { execSync } from 'node:child_process';
import { TEST_DATABASE_URL } from '../vitest.config.js';

// Runs once before all test files: bring the test database schema up to date
// using the same migrations production uses.
export default function setup() {
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'pipe',
  });
}
