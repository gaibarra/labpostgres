module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true
  },
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  settings: { react: { version: 'detect' } },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended'
  ],
  plugins: ['react','react-hooks'],
  overrides: [
    {
      files: ['server/tests/**/*.js','**/__tests__/**/*.[jt]s?(x)','**/*.test.[jt]s?(x)'],
      env: { node: true },
      globals: {
        describe: 'readonly',
        test: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly'
      },
      rules: { 'no-unused-expressions': 'off' }
    },
    {
      files: ['dist/**','**/dist/**'],
      rules: {
        'no-unused-vars': 'off',
        'no-undef': 'off',
        'no-empty': 'off'
      }
    }
  ],
  ignorePatterns: ['dist/**/*'],
  rules: {
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'react/prop-types': 'off',
    'react/react-in-jsx-scope': 'off'
  }
};
