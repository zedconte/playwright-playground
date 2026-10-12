import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import vue from 'eslint-plugin-vue';
import playwright from 'eslint-plugin-playwright';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default defineConfig(
  { ignores: ['dashboard/dist/', 'coverage-report/', 'playwright-report/', 'test-results/', '.discovery/'] },

  js.configs.recommended,
  tseslint.configs.recommended,
  vue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },

  {
    files: ['framework/**', 'sites/**', 'tests/**', '*.config.*'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['dashboard/**'],
    languageOptions: { globals: globals.browser },
  },

  // Playwright rules for the end-to-end suites only (unit tests use Vitest).
  {
    ...playwright.configs['flat/recommended'],
    files: ['tests/**/*.spec.ts'],
  },
  {
    // Generated suites are data-driven: they branch on site config and element type by design,
    // and tag with the shared DISCOVERED_TAG constant, which the tag rule cannot evaluate.
    files: ['tests/discovered/**'],
    rules: {
      'playwright/no-conditional-in-test': 'off',
      'playwright/no-conditional-expect': 'off',
      'playwright/valid-test-tags': 'off',
    },
  },

  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },

  // Must stay last: turns off rules that conflict with Prettier.
  prettier,
);
