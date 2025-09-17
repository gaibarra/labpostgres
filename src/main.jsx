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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
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
  </React.StrictMode>
);