import React, { createContext, useState, useEffect, useContext } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/apiClient';

const ThemeContext = createContext({
  theme: 'light',
  toggleTheme: () => {},
  setSpecificTheme: (_theme) => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children, defaultTheme = 'light' }) => {
  const { user } = useAuth();
  const [theme, setTheme] = useState(defaultTheme);
  const [ready, setReady] = useState(false);

  // Carga tema desde backend si autenticado; caso contrario usa default sin persistir en localStorage
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (user) {
          const res = await apiClient.get('/profiles/me/theme?debug=0').catch(() => null);
          if (!cancelled) setTheme(res?.theme || defaultTheme);
        } else if (!cancelled) {
          setTheme(defaultTheme);
        }
      } catch {
        if (!cancelled) setTheme(defaultTheme);
  } finally { if (!cancelled) setReady(true); }
    })();
    return () => { cancelled = true; };
  // Nota: Eliminado storageKey/localStorage para cumplir requisito de no persistir en cliente.
  }, [user, defaultTheme]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    if (theme) {
      root.classList.add(theme);
      if (user && ready) apiClient.put('/profiles/me/theme', { theme }).catch(() => { /* silence 500 theme */ });
    }
  }, [theme, user, ready]);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  const setSpecificTheme = (newTheme) => {
    if (newTheme === 'light' || newTheme === 'dark') {
      setTheme(newTheme);
    }
  };

  const value = {
    theme,
    toggleTheme,
    setSpecificTheme,
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};