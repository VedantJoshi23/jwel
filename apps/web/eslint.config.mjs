import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default tseslint.config(
  {
    ignores: ['.next/**', 'coverage/**', 'node_modules/**', 'next-env.d.ts', 'playwright-report/**', 'test-results/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // `eslint-config-next` still ships as eslintrc-style, so it is bridged rather
  // than imported directly. It carries the react-hooks and next/core-web-vitals
  // rules that catch the defects worth catching in an App Router codebase.
  ...compat.extends('next/core-web-vitals'),
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // The only current use is server-built JSON-LD, which already carries an
      // inline exemption. Enabling this makes any *new* raw-HTML injection an
      // explicit, reviewed decision rather than a silent one.
      'react/no-danger': 'error',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', 'e2e/**/*.ts'],
    rules: {
      // Every `any` in this app is in a test, standing in for a fetch/Response
      // or a vendor global (Razorpay) we do not own the types for. Production
      // code has none, and the rule above keeps it that way.
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
