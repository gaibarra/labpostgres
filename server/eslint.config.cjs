// ESLint v9 Flat Config (CommonJS) para el servidor
/** @type {import('eslint').Linter.FlatConfig[]} */
module.exports = [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      'tests/**',
      'scripts/**/*.sql',
    ],
  },
  {
    files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        process: 'readonly',
        __dirname: 'readonly',
        module: 'readonly',
        require: 'readonly',
        console: 'readonly',
      },
    },
    rules: {
      // Reducimos ruido en consola de CI al permitir variables no usadas (p. ej. placeholders '_' o 'e').
      // Si en el futuro queremos endurecer esto, podemos activar de nuevo y migrar a prefijos _.
      'no-unused-vars': 'off',
      'no-constant-condition': ['warn', { checkLoops: false }],
      // Permitimos catch vacío para bloques que intencionalmente sólo documentan/ignoran errores.
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-useless-catch': 'off',
      'no-console': 'off',
    },
  },
];
