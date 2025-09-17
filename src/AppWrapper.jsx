import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useAppData } from '@/contexts/AppDataContext';
import { useAppDataInitialization } from '@/hooks/useAppDataInitialization';

const AppWrapper = ({ children }) => {
  const { loading: isAuthLoading } = useAuth();
  const { isLoading: areSettingsLoading, isInitialized: areSettingsInitialized } = useSettings();
  const { isLoading: isAppDataLoading } = useAppData();
  const { isLoading: isDataInitializationLoading } = useAppDataInitialization();

  const isLoading = isAuthLoading || areSettingsLoading || !areSettingsInitialized || isAppDataLoading || isDataInitializationLoading;

  if (isLoading) {
    let loadingMessage = "Inicializando aplicación...";
    if (isAuthLoading) {
      loadingMessage = "Verificando autenticación...";
    } else if (areSettingsLoading || !areSettingsInitialized) {
      loadingMessage = "Cargando configuración...";
    } else if (isAppDataLoading) {
      loadingMessage = "Cargando datos de la aplicación...";
    } else if (isDataInitializationLoading) {
      loadingMessage = "Finalizando inicialización...";
    }

    return (
      <div className="flex items-center justify-center h-screen bg-slate-100 dark:bg-slate-900">
        <div className="flex flex-col items-center">
          <svg className="animate-spin h-16 w-16 text-sky-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="mt-4 text-lg font-semibold text-slate-700 dark:text-slate-300">
            {loadingMessage}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">Esto podría tardar un momento.</p>
        </div>
      </div>
    );
  }

  return children;
};

export default AppWrapper;