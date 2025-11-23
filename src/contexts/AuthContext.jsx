import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { apiClient, clearToken, getToken, setToken } from '@/lib/apiClient';
import { useToast } from '@/components/ui/use-toast';

    const AuthContext = createContext(undefined);

// Normaliza la forma del usuario para que el resto de la app (que asumía user.profile.role, etc.) siga funcionando
function normalizeUser(raw) {
  if (!raw || typeof raw !== 'object') return null;
  // Si ya trae profile asumimos que está normalizado
  if (raw.profile) return raw;
  let first_name = raw.first_name || null;
  let last_name = raw.last_name || null;
  if (!first_name && !last_name && raw.full_name) {
    const parts = raw.full_name.trim().split(/\s+/);
    if (parts.length === 1) {
      first_name = parts[0];
    } else if (parts.length > 1) {
      first_name = parts.shift();
      last_name = parts.join(' ');
    }
  }
  return {
    ...raw,
    profile: {
      role: raw.role || null,
      first_name,
      last_name,
      full_name: raw.full_name || [first_name, last_name].filter(Boolean).join(' ') || null
    }
  };
}

// AuthProvider
// Ahora acepta opcionalmente initialUser (solo pensado para pruebas) para inyectar
// un usuario ya autenticado y evitar la llamada a /auth/me. En producción no se usa.
export const AuthProvider = ({ children, initialUser = null }) => {
      const { toast } = useToast();
  const [user, setUser] = useState(initialUser ? normalizeUser(initialUser) : null);
  const [loading, setLoading] = useState(!initialUser); // si viene initialUser ya estamos listos

    const loadCurrentUser = useCallback(async () => {
        if (!getToken()) { setUser(null); return; }
        try {
          const data = await apiClient.auth.me();
          const rawUser = data && (data.user || data);
          setUser(normalizeUser(rawUser));
        } catch (e) {
          const isInvalid = e.status === 401 || e.status === 404 || (e.status === 404 && (e.code === 'USER_NOT_FOUND' || e.details?.error === 'Usuario no encontrado'));
          if (isInvalid) {
            clearToken();
            setUser(null);
          } else {
            console.error('Error fetching current user', e);
          }
        }
      }, []);

      useEffect(() => {
        if (initialUser) return; // en pruebas skip fetch /auth/me
        // 1) Bootstrap: token en hash (#at=TOKEN) cuando abrimos pestañas de impresión protegidas
        try {
          const hash = typeof window !== 'undefined' ? window.location.hash : '';
          const m = hash && hash.match(/[#&]at=([^&]+)/);
          if (m && m[1] && !getToken()) {
            const token = decodeURIComponent(m[1]);
            if (token) setToken(token);
          }
        } catch (_) { /* noop */ }

        // 2) Listener para recibir token via postMessage desde la pestaña origen
        const handler = (e) => {
          try {
            if (!e || !e.data) return;
            if (e.origin !== window.location.origin) return;
            if (e.data.type === 'LABG40_AUTH_TOKEN' && e.data.token && !getToken()) {
              setToken(e.data.token);
              (async () => { setLoading(true); await loadCurrentUser(); setLoading(false); })();
            }
          } catch(_) { /* ignore */ }
        };
        try { window.addEventListener('message', handler); } catch(_) { /* ignore */ }

        // 3) Cargar usuario actual (ya con token si vino en hash). Para rutas de impresión sin token aún, esperar a postMessage.
        try {
          const isPrintRoute = typeof window !== 'undefined' && /^\/print\//.test(window.location.pathname);
          if (!isPrintRoute || getToken()) {
            (async () => { setLoading(true); await loadCurrentUser(); setLoading(false); })();
          } else {
            // No token y estamos en ruta de impresión: permitir que ProtectedRoute muestre hijos y esperar mensaje.
            setLoading(false);
          }
        } catch { /* ignore */ }
        return () => { try { window.removeEventListener('message', handler); } catch(_) { /* ignore */ } };
      }, [loadCurrentUser, initialUser]);

    const signUp = useCallback(async (email, password, firstName, lastName) => {
        setLoading(true);
        try {
          const { user: newUser } = await apiClient.auth.register({ email, password, full_name: [firstName, lastName].filter(Boolean).join(' ') });
          toast({ title: 'Registro exitoso', description: 'Tu cuenta ha sido creada.' });
      const norm = normalizeUser(newUser);
      setUser(norm);
      return { user: norm, error: null };
        } catch (error) {
          toast({ variant: 'destructive', title: 'Error de Registro', description: error.message });
          return { user: null, error };
        } finally { setLoading(false); }
      }, [toast]);

    const signIn = useCallback(async (email, password) => {
        setLoading(true);
        try {
          const { user: loggedUser } = await apiClient.auth.login({ email, password });
          toast({ title: 'Bienvenido', description: 'Has iniciado sesión.' });
      const norm = normalizeUser(loggedUser);
      setUser(norm);
      return { user: norm, error: null };
        } catch (error) {
          toast({ variant: 'destructive', title: 'Error de Inicio de Sesión', description: error.message });
          return { user: null, error };
        } finally { setLoading(false); }
      }, [toast]);

      const signOut = useCallback(async () => {
        setLoading(true);
  try { await apiClient.auth.logout(); } catch (_) { /* ignore logout network errors */ }
        clearToken();
        setUser(null);
        toast({ title: 'Sesión cerrada', description: 'Has cerrado sesión.' });
        setLoading(false);
        return { error: null };
      }, [toast]);

      const resetPasswordForEmail = useCallback(async (email) => {
        try {
          const data = await apiClient.auth.forgotPassword({ email });
          return { error: null, data };
        } catch (error) {
          toast({ variant: 'destructive', title: 'Error al enviar enlace', description: error.message || 'No se pudo enviar el correo de restablecimiento.' });
          return { error };
        }
      }, [toast]);

      const completePasswordReset = useCallback(async ({ token, password }) => {
        try {
          const data = await apiClient.auth.resetPassword({ token, password });
          return { error: null, data };
        } catch (error) {
          toast({ variant: 'destructive', title: 'Error al restablecer', description: error.message || 'No se pudo actualizar la contraseña.' });
          return { error };
        }
      }, [toast]);

      const updatePassword = useCallback(async ({ currentPassword, newPassword }) => {
        try {
          const data = await apiClient.auth.changePassword({ currentPassword, newPassword });
          toast({ title: 'Contraseña actualizada', description: 'Tu contraseña se ha cambiado correctamente.' });
          return { error: null, data };
        } catch (error) {
          toast({ variant: 'destructive', title: 'Error al actualizar', description: error.message || 'No se pudo actualizar la contraseña.' });
          return { error };
        }
      }, [toast]);

      const value = useMemo(() => ({ user, loading, signUp, signIn, signOut, resetPasswordForEmail, completePasswordReset, updatePassword }), [user, loading, signUp, signIn, signOut, resetPasswordForEmail, completePasswordReset, updatePassword]);
      return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
    };

    export const useAuth = () => {
      const context = useContext(AuthContext);
      if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
      return context;
    };