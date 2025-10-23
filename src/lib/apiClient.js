// Simple fetch-based API client for the custom backend.
// Automatically attaches JWT token from storage and handles JSON.

// Token en memoria con persistencia opcional en localStorage para sobrevivir recargas.
let inMemoryToken = null;

const STORAGE_KEY = 'labg40.auth.token';
try {
  const stored = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
  if (stored) inMemoryToken = stored;
} catch { /* ignore storage errors (e.g., SSR or privacy mode) */ }

// Robust resolution of API base URL with diagnostics.
function resolveApiBase() {
  const explicit = import.meta.env?.VITE_API_BASE_URL;
  // Use relative '/api' so Vite dev proxy (vite.config.js) forwards to Express (default :4100)
  // and in production it works when the frontend is served by the same origin as the API.
  const fallback = '/api';
  if (explicit && typeof explicit === 'string') {
    // Permitir base relativa (ej. /api) para usar proxy de Vite o misma-origin en prod.
    if (explicit.startsWith('/')) {
      const cleaned = explicit.replace(/\/$/, '');
      // Caso especial: 'vite preview' (puerto 4173) NO implementa el proxy dev.
      // Si estamos en ese puerto y el backend corre separado en 4100, redirigimos a absoluto.
      if (typeof window !== 'undefined' && window.location && window.location.port === '4173') {
        const alt = 'http://localhost:4100' + cleaned;
        console.warn('[apiClient] Remapeando base relativa', cleaned, '→', alt, 'porque vite preview no hace proxy');
        return alt;
      }
      return cleaned;
    }
    if (!/^https?:\/\//.test(explicit)) {
      console.warn('[apiClient] VITE_API_BASE_URL no incluye protocolo (http/https). Corrígelo o usa formato relativo \'/api\'. Usando fallback:', fallback);
      return fallback;
    }
    return explicit.replace(/\/$/, '');
  }
  const dev = import.meta.env?.DEV;
  if (!explicit) {
    const msg = `[apiClient] VITE_API_BASE_URL no definido. Usando fallback ${fallback}. Puedes definir VITE_API_BASE_URL=/api en .env para explicitarlo.`;
    if (dev) console.warn(msg); else console.warn(msg);
    // Fallback especial: si estamos sirviendo build con `vite preview` (puerto 4173) y el backend corre en 4100
    // usar URL absoluta para evitar 500/404 cuando no hay reverse proxy.
    if (typeof window !== 'undefined' && window.location && window.location.port === '4173') {
      const alt = 'http://localhost:4100/api';
      console.warn('[apiClient] Usando fallback alternativo', alt, 'porque no hay VITE_API_BASE_URL y estamos en puerto 4173');
      return alt;
    }
    // En producción ya no lanzamos excepción: permitimos fallback para single-host (/api).
  }
  return fallback;
}

const API_BASE = resolveApiBase();

export function getToken() { return inMemoryToken; }
export function setToken(token) {
  inMemoryToken = token || null;
  try {
    if (typeof window !== 'undefined') {
      if (inMemoryToken) window.localStorage.setItem(STORAGE_KEY, inMemoryToken);
      else window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch { /* ignore storage errors */ }
}
export function clearToken() {
  inMemoryToken = null;
  try { if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

// Sincroniza entre pestañas: si otra pestaña borra/actualiza el token, reflejarlo aquí.
try {
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY) {
        inMemoryToken = e.newValue || null;
      }
    });
  }
} catch { /* ignore */ }

async function request(path, { method = 'GET', body, headers = {}, auth = true, timeoutMs = 15000, signal: externalSignal } = {}) {
  const token = getToken();
  const isForm = (typeof FormData !== 'undefined') && (body instanceof FormData);
  const finalHeaders = { 'Accept': 'application/json', ...headers };
  // Para JSON: sólo establecer Content-Type si el body no es FormData
  if (!isForm) finalHeaders['Content-Type'] = finalHeaders['Content-Type'] || 'application/json';
  if (auth && token) finalHeaders['Authorization'] = `Bearer ${token}`;
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  const startedAt = performance.now();
  if (import.meta.env.DEV) {
    console.debug('[apiClient] ->', method, url, { auth, hasToken: !!token });
  }
  // Si el caller provee un AbortSignal, lo usamos y omitimos nuestro timeout local.
  const ac = externalSignal ? null : new AbortController();
  const t = externalSignal ? null : setTimeout(() => {
    try { ac.abort('timeout'); }
    catch (e) {
      try { ac.abort(); } catch (e2) { /* noop: abort fallback */ }
    }
  }, timeoutMs);
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: finalHeaders,
      body: body === undefined ? undefined : (isForm ? body : JSON.stringify(body)),
      signal: externalSignal || ac.signal
    });
  } catch (netErr) {
    if (t) clearTimeout(t);
    const isAbort = netErr?.name === 'AbortError';
    const msg = netErr?.message || '';
    const isConnRefused = /Failed to fetch|NetworkError|ECONNREFUSED/i.test(msg);
    if (isAbort) {
      const abortErr = new Error('Timeout de solicitud (' + timeoutMs + 'ms).');
      abortErr.name = 'TimeoutError';
      abortErr.cause = netErr;
      throw abortErr;
    }
    if (isConnRefused && /localhost:4100/.test(url)) {
      const ac2 = new AbortController();
      const altUrl = url.replace('localhost:4100','127.0.0.1:4100');
      if (import.meta.env.DEV) console.warn('[apiClient] Reintentando con 127.0.0.1:', altUrl);
      if (!externalSignal) setTimeout(() => {
        try { ac2.abort('timeout'); } catch (e) { /* noop: abort fallback */ }
      }, timeoutMs / 2);
      res = await fetch(altUrl, {
        method,
        headers: finalHeaders,
        body: body === undefined ? undefined : (isForm ? body : JSON.stringify(body)),
        signal: externalSignal || ac2.signal
      });
    } else {
      if (isConnRefused) console.error(`[apiClient] No se pudo conectar a ${url}. Backend cado o puerto incorrecto.`);
      throw netErr;
    }
  } finally {
    if (t) clearTimeout(t);
  }
  if (res.status === 204) return null;
  let data;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) {
    const error = new Error(data?.message || `Error ${res.status}`);
    error.status = res.status;
    error.code = data?.code;
    error.details = data;
    // Si el token es inválido o expiró, lo limpiamos para evitar loops de 401
    if (res.status === 401 && (data?.code === 'TOKEN_INVALID' || data?.code === 'TOKEN_EXPIRED')) {
      try { clearToken(); } catch { /* ignore */ }
    }
    if (import.meta.env.DEV) {
      console.debug('[apiClient] <-', method, url, res.status, '(error)', 'durMs=', (performance.now()-startedAt).toFixed(0));
    }
    throw error;
  }
  if (import.meta.env.DEV) {
    console.debug('[apiClient] <-', method, url, res.status, 'durMs=', (performance.now()-startedAt).toFixed(0));
  }
  return data;
}

export const apiClient = {
  get: (path, opts) => request(path, { ...(opts||{}), method: 'GET' }),
  post: (path, body, opts) => request(path, { ...(opts||{}), method: 'POST', body }),
  put: (path, body, opts) => request(path, { ...(opts||{}), method: 'PUT', body }),
  patch: (path, body, opts) => request(path, { ...(opts||{}), method: 'PATCH', body }),
  delete: (path, opts) => request(path, { ...(opts||{}), method: 'DELETE' }),
  auth: {
    async register({ email, password, full_name, role }) {
      const data = await apiClient.post('/auth/register', { email, password, full_name, role }, { auth: false });
      if (data?.token) setToken(data.token);
      return data;
    },
    async login({ email, password }) {
      const data = await apiClient.post('/auth/login', { email, password }, { auth: false });
      if (data?.token) setToken(data.token);
      return data;
    },
    async me() {
      try {
        return await apiClient.get('/auth/me');
      } catch (e) {
        // Tratar 401 (token inválido/expirado) y 404 USER_NOT_FOUND como sesión inválida
        if (
          e.status === 401 ||
          (e.status === 404 && (e.code === 'USER_NOT_FOUND' || e.details?.error === 'Usuario no encontrado'))
        ) {
          try { clearToken(); } catch { /* ignore */ }
        }
        throw e;
      }
    },
    async logout() {
      try { await apiClient.post('/auth/logout', {}); }
      catch (e) { /* noop: ignore network errors on logout */ }
      clearToken();
    }
  }
};

export default apiClient;
