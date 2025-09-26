import { expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

// Basic alert mock (used in ParameterEditDialog validation)
if (!window.alert) {
  window.alert = (...args) => { /* silent mock */ };
}

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Supabase mock & related test scaffolding removed after full migration to custom backend.

// Polyfill mínimo para ResizeObserver (usado por recharts ResponsiveContainer)
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  class ResizeObserverMock {
    constructor(cb) { this.cb = cb; }
    observe() { /* no-op */ }
    unobserve() { /* no-op */ }
    disconnect() { /* no-op */ }
  }
  window.ResizeObserver = ResizeObserverMock;
  global.ResizeObserver = ResizeObserverMock;
}

// Ensure fetch works with relative URLs in JSDOM/Node
// Node's fetch (undici) requires absolute URLs; some UI code may call fetch('/api/...').
// In tests, transparently prefix a base origin to relative requests to avoid unhandled rejections.
(() => {
  const originalFetch = globalThis.fetch;
  if (typeof originalFetch === 'function') {
    const baseFromEnv = (typeof process !== 'undefined' && process.env && process.env.VITE_API_BASE_URL) || '';
    // Prefer explicit env, else default dev backend origin (no trailing slash)
    const defaultOrigin = 'http://localhost:3001';
    const baseOrigin = baseFromEnv && baseFromEnv.startsWith('http')
      ? baseFromEnv.replace(/\/$/, '').replace(/\/api$/, '')
      : defaultOrigin;

    globalThis.fetch = (input, init) => {
      // Intercept specific noisy calls in tests (e.g., POST /api/analysis) to avoid unhandled rejections
      try {
        const method = (init && init.method) || (typeof Request !== 'undefined' && input instanceof Request ? input.method : 'GET');
        let urlStr = '';
        if (typeof input === 'string') urlStr = input;
        else if (typeof Request !== 'undefined' && input instanceof Request) urlStr = input.url;

        // Normalize to absolute for comparison
        const absUrl = urlStr.startsWith('http') ? urlStr : `${baseOrigin}${urlStr.startsWith('/') ? '' : '/'}${urlStr}`;

        if (method?.toUpperCase() === 'POST' && /\/api\/analysis(?:$|[?#])/.test(absUrl)) {
          let body = undefined;
          try {
            if (init && typeof init.body === 'string') body = JSON.parse(init.body);
          } catch (_) { /* ignore parse errors */ }

          const mock = {
            id: 'test-analysis-id',
            created_at: new Date().toISOString(),
            // echo relevant fields from request if present
            ...(body && typeof body === 'object' ? body : {}),
          };
          return Promise.resolve(new Response(JSON.stringify(mock), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          }));
        }

        // POST /api/audit: accept and return created
        if (method?.toUpperCase() === 'POST' && /\/api\/audit(?:$|[?#])/.test(absUrl)) {
          return Promise.resolve(new Response(JSON.stringify({ ok: true }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          }));
        }

        // POST /api/analysis/:id/parameters-sync: acknowledge sync
        if (method?.toUpperCase() === 'POST' && /\/api\/analysis\/[^/]+\/parameters-sync(?:$|[?#])/.test(absUrl)) {
          return Promise.resolve(new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }));
        }
      } catch (_) {
        // fallthrough to normal flow
      }

      try {
        if (typeof input === 'string' && input.startsWith('/')) {
          return originalFetch(`${baseOrigin}${input}`, init);
        }
        // If a Request object with relative URL was passed, rebuild it with absolute URL
        if (typeof Request !== 'undefined' && input instanceof Request && input.url && input.url.startsWith('/')) {
          const rebuilt = new Request(`${baseOrigin}${input.url}`, input);
          return originalFetch(rebuilt, init);
        }
      } catch (_) {
        // fallthrough to original fetch if any check fails
      }
      return originalFetch(input, init);
    };
  }
})();