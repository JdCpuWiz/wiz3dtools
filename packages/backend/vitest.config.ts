import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // ESM + workspace-shared package import path resolves via tsconfig paths.
    // No setup file yet — tests mock the model layer rather than hitting a
    // real Postgres. When/if a test DB is added, gate it via env and skip
    // the integration suite if absent rather than hard-failing CI runs.
    globals: false,
    environment: 'node',
  },
});
