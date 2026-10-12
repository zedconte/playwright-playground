import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

/**
 * Unit tests (Vitest). They live next to the code as `*.test.ts`, outside `tests/`,
 * which belongs to Playwright. Files that need a DOM opt in with `// @vitest-environment happy-dom`.
 */
export default defineConfig({
  plugins: [vue()],
  test: {
    include: ['framework/**/*.test.ts', 'dashboard/src/**/*.test.ts'],
    environment: 'node',
  },
});
