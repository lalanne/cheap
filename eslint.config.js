// Spec 015. Formatting is Prettier's job; eslint-config-prettier goes
// last so ESLint never argues with it.
const expoConfig = require('eslint-config-expo/flat');
const prettier = require('eslint-config-prettier/flat');

module.exports = [
  ...expoConfig,
  prettier,
  {
    // Jest globals in tests and the setup file.
    files: ['**/__tests__/**', 'jest.setup.js'],
    languageOptions: { globals: { jest: 'readonly' } },
  },
  {
    // `jest.mock(...)` must precede the imports it affects, and mock
    // factories can't use `import` — so these two rules don't fit tests.
    files: ['**/__tests__/**'],
    rules: { 'import/first': 'off', '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    ignores: [
      'node_modules/',
      'coverage/',
      'dist/',
      'web-build/',
      '.expo/',
      '.firebase/',
      'ios/',
      'android/',
      'src/__fixtures__/',
    ],
  },
];
