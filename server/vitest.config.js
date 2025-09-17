/**
 * Vitest config for server-side tests (isolated from root web app config).
 */
module.exports = {
  test: {
    environment: 'node',
    root: __dirname,
    include: ['tests/**/*.test.js'],
    reporters: 'basic',
    hookTimeout: 20000,
    testTimeout: 20000,
    // Evitar ejecución en paralelo de archivos de test para no interferir
    // con estados globales compartidos (p. ej., lab_configuration de una sola fila)
    minThreads: 1,
    maxThreads: 1,
    globals: true,
  }
};
