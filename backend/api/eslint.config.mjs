import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import noUnsafeRowAccess from './eslint-rules/no-unsafe-row-access.mjs';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    plugins: {
      'heuresys': {
        rules: {
          'no-unsafe-row-access': noUnsafeRowAccess,
        },
      },
    },
    rules: {
      'heuresys/no-unsafe-row-access': 'warn',
      // TypeScript specific - warn level for initial setup
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-namespace': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',

      // General - warn level for initial setup
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'prefer-const': 'warn',
      'no-var': 'warn',
      'eqeqeq': 'warn',
      'no-case-declarations': 'warn',
      'no-useless-escape': 'warn',
    },
  },
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      '**/*.js',
      '**/*.cjs',
      '**/*.mjs',
    ],
  }
);
