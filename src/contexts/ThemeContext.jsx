import React, { createContext, useState, useEffect, useContext } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/apiClient';

const ThemeContext = createContext({
  theme: 'light',
  toggleTheme: () => {},
  setSpecificTheme: (theme) => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children, defaultTheme = 'light', storageKey = 'vite-ui-theme' }) => {
  const { user } = useAuth();
  const [theme, setTheme] = useState(defaultTheme);
  const [ready, setReady] = useState(false);

  // Load theme from backend for authenticated users; fallback to localStorage for guests
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (user) {
          const res = await apiClient.get('/profiles/me/theme');
          if (!cancelled) setTheme(res?.theme || defaultTheme);
        } else {
          const fromLocal = localStorage.getItem(storageKey) || defaultTheme;
          if (!cancelled) setTheme(fromLocal);
        }
      } catch {
        const fromLocal = localStorage.getItem(storageKey) || defaultTheme;
        if (!cancelled) setTheme(fromLocal);
  } finally { if (!cancelled) setReady(true); }
    })();
    return () => { cancelled = true; };
  }, [user, defaultTheme, storageKey]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    if (theme) {
      root.classList.add(theme);
      // Persist: DB for authenticated users, else localStorage fallback
      if (user && ready) {
        apiClient.put('/profiles/me/theme', { theme }).catch(() => {});
      } else {
        localStorage.setItem(storageKey, theme);
      }
    }
  }, [theme, storageKey, user, ready]);

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