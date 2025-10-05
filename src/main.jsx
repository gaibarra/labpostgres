import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router } from 'react-router-dom';
import App from '@/App';
import '@/index.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { Toaster } from '@/components/ui/toaster';
import { AppDataProvider } from '@/contexts/AppDataContext';
import AppWrapper from '@/AppWrapper';

// Cargar domGuards si estamos en DEV o si forzamos auditoría en producción vía variable VITE_ENABLE_DOM_GUARDS
if (import.meta.env.DEV || import.meta.env.VITE_ENABLE_DOM_GUARDS === '1') {
  import('./dev/domGuards').catch(e => console.warn('[domGuards] load failed', e));
}

ReactDOM.createRoot(document.getElementById('root')).render(
  // StrictMode removido temporalmente para diagnosticar doble invocación de efectos
  <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <AuthProvider>
      <ThemeProvider>
        <SettingsProvider>
          <AppDataProvider>
            <AppWrapper>
              <App />
            </AppWrapper>
          </AppDataProvider>
        </SettingsProvider>
        <Toaster />
      </ThemeProvider>
    </AuthProvider>
  </Router>
);