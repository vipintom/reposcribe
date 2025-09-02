import js from '@eslint/js';
import tseslint from 'typescript-eslint';

// Using tseslint.config is the recommended helper for type-safe configs.
export default tseslint.config(
  // Global ignores
  {
    ignores: ['dist/', 'node_modules/', '*.js', '*.mjs', '.history/'],
  },

  // Base recommended configs
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Custom rules for TypeScript files
  {
    files: ['src/**/*.ts'], // Apply these rules specifically to TS source files
    rules: {
      '@typescript-eslint/naming-convention': [
        'warn',
        {
          selector: 'import',
          format: ['camelCase', 'PascalCase'],
        },
      ],
      curly: 'warn',
      eqeqeq: 'warn',
      'no-throw-literal': 'warn',
      semi: ['error', 'always'],
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  }
);
