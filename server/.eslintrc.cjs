/* ESLint configuración básica para el servidor */
module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
    jest: false,
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'script',
  },
  rules: {
    'no-unused-vars': ['warn', { args: 'none', ignoreRestSiblings: true }],
    'no-constant-condition': ['warn', { checkLoops: false }],
    'no-empty': ['warn', { allowEmptyCatch: false }],
    'no-console': 'off',
  },
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'coverage/',
    'scripts/**/*.sql',
  ],
};