import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
  { ignores: ['dist/', 'legacy/', 'node_modules/', '.idea/'] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
  },
  {
    files: ['scripts/**/*.js'],
    languageOptions: { globals: { ...globals.browser, turnstile: 'readonly' } },
  },
  prettier,
];
