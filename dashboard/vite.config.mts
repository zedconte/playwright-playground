import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

/**
 * Builds the coverage dashboard. The coverage reporter takes `dist/`, inlines its JS/CSS
 * and injects the run's data, producing a single offline `coverage-report/index.html`.
 *
 * `npm run dashboard:dev` serves the last run's `coverage-report/coverage.json` with hot reload.
 */
export default defineConfig(({ command }) => ({
  plugins: [vue()],
  base: './',
  publicDir: command === 'serve' ? '../coverage-report' : false,
  server: { fs: { allow: ['..'] } },
  build: { outDir: 'dist', emptyOutDir: true, assetsInlineLimit: 100_000 },
}));
