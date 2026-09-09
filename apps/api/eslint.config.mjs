import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'src/prisma/generated/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      // NestJS leans on decorator metadata and constructor injection, which
      // trips several stylistic defaults that are not defects here.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Application code logs through Nest's Logger so that output carries a
      // context and correlation id (STD-OBSERVABILITY). There is currently no
      // `console.*` outside the seed scripts below; this keeps it that way.
      'no-console': 'error',
    },
  },
  {
    // Seed, migration and CLI scripts are operator-facing: stdout *is* their
    // interface, and there is no request context for a Logger to attach to.
    files: ['src/prisma/**/*.ts', 'scripts/**/*.ts', '**/*.spec.ts', 'test/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    files: ['**/*.spec.ts', '**/*.integration-spec.ts', 'test/**/*.ts'],
    rules: {
      // Test doubles legitimately reach for `any` when standing in for a
      // vendor SDK surface we do not own.
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
