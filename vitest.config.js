import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './setupTests.js',
    exclude: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      '.git/**',
      'server/**', // evita recoger pruebas del backend aquí
    ],
  }
});
