import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
// Settings now loaded from backend /api/config endpoints (Express + PostgreSQL)
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from '@/contexts/AuthContext';
import { deepmerge } from 'deepmerge-ts';
import { apiClient } from '@/lib/apiClient';

const defaultSettings = {
  labInfo: {
    name: "Mi Laboratorio",
    razonSocial: "",
    taxId: "",
    logoUrl: "",
    calle: "",
    numeroExterior: "",
    numeroInterior: "",
    colonia: "",
    codigoPostal: "",
    ciudad: "",
    estado: "",
    pais: "México",
    phone: "555-1234",
    secondaryPhone: "",
    email: "contacto@laboratorio.com",
    website: "",
    responsableSanitarioNombre: "",
    responsableSanitarioCedula: "",
  },
  reportSettings: {
    header: "Encabezado por defecto",
    footer: "Pie de página por defecto",
    showLogo: true
  },
  uiSettings: {
    theme: "system",
    primaryColor: "#0ea5e9"
  },
  regionalSettings: {
    dateFormat: "dd/MM/yyyy",
    timeZone: "America/Hermosillo",
    currency: "USD"
  },
  integrations: {
    openaiApiKey: "",
    deepseekKey: "",
    perplexityKey: "",
    emailServiceProvider: "",
    emailApiUser: "",
    emailApiKey: "",
    whatsappApiUrl: "",
    whatsappApiKey: "",
    telegramBotToken: "",
    telegramChatId: ""
  },
  taxSettings: {
    taxName: "IVA",
    taxRate: 16,
    taxIdName: "RFC"
  }
};

const dbToFrontendMapping = {
  lab_info: 'labInfo',
  report_settings: 'reportSettings',
  ui_settings: 'uiSettings',
  regional_settings: 'regionalSettings',
  integrations_settings: 'integrations',
  tax_settings: 'taxSettings',
};

const frontendToDbMapping = {
  labInfo: 'lab_info',
  reportSettings: 'report_settings',
  uiSettings: 'ui_settings',
  regionalSettings: 'regional_settings',
  integrations: 'integrations_settings',
  taxSettings: 'tax_settings',
};

const SettingsContext = createContext({
  settings: null,
  isLoading: true,
  updateSettings: async () => {},
  isInitialized: false,
});

export const SettingsProvider = ({ children }) => {
  const { user, session, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  const processAndSetSettings = useCallback((dbData) => {
    const frontendSettings = {};
    // Detect shape: backend is already returning friendly keys (labInfo, integrations...) OR raw db keys (lab_info,...)
    const hasDbShape = Object.keys(dbToFrontendMapping).some(k => Object.prototype.hasOwnProperty.call(dbData, k));
    const hasFriendlyShape = Object.values(dbToFrontendMapping).some(v => Object.prototype.hasOwnProperty.call(dbData, v));
    if (hasDbShape && !hasFriendlyShape) {
      // Raw DB shape: map using dbToFrontendMapping
      for (const dbKey in dbToFrontendMapping) {
        const frontendKey = dbToFrontendMapping[dbKey];
        frontendSettings[frontendKey] = dbData[dbKey] || {};
      }
    } else {
      // Friendly shape (current API behavior): copy expected friendly keys directly
      for (const feKey of Object.values(dbToFrontendMapping)) {
        frontendSettings[feKey] = dbData[feKey] || {};
      }
    }
    
  const openaiApiKeyFromDb = frontendSettings.integrations.openaiApiKey || frontendSettings.integrations.openAIKey || '';
    if (openaiApiKeyFromDb) {
      frontendSettings.integrations.openaiApiKey = openaiApiKeyFromDb;
    }
    delete frontendSettings.integrations.openAIKey;
  console.log('[SettingsContext] processAndSetSettings RAW integrations keys', Object.keys(frontendSettings.integrations || {}));

    const mergedSettings = deepmerge(defaultSettings, frontendSettings);
    
    mergedSettings.regionalSettings.timeZone = "America/Hermosillo";

  mergedSettings.id = dbData.id || mergedSettings.id || null;
    mergedSettings.created_at = dbData.created_at;
    mergedSettings.updated_at = dbData.updated_at;
    
    setSettings(mergedSettings);
    return mergedSettings;
  }, []);

  const fetchSettings = useCallback(async (abortController) => {
    if (!user || !session) {
      setIsLoading(false);
      setIsInitialized(true);
      if (!settings) setSettings(defaultSettings);
      return;
    }
    setIsLoading(true);
    try {
      const data = await apiClient.get('/config', { signal: abortController.signal });
      if (!abortController.signal.aborted && data) {
        const merged = processAndSetSettings(data);
        // One-time migration from legacy localStorage settings (if any) -> backend
        try {
          const migratedKey = 'labSettingsComplete_migrated';
          const legacyKey = 'labSettingsComplete';
          const alreadyMigrated = typeof window !== 'undefined' ? localStorage.getItem(migratedKey) : '1';
          const legacyRaw = typeof window !== 'undefined' ? localStorage.getItem(legacyKey) : null;
          if (!alreadyMigrated && legacyRaw) {
            const legacy = JSON.parse(legacyRaw);
            const legacyLabInfo = {
              name: legacy.labName || '',
              logoUrl: legacy.labLogoPreview || '',
              razonSocial: legacy.razonSocial || '',
              taxId: legacy.rfc || '',
              calle: legacy.calle || '',
              numeroExterior: legacy.numeroExterior || '',
              numeroInterior: legacy.numeroInterior || '',
              colonia: legacy.colonia || '',
              codigoPostal: legacy.codigoPostal || '',
              ciudad: legacy.ciudad || '',
              estado: legacy.estado || '',
              pais: legacy.pais || 'México',
              phone: legacy.telefonoPrincipal || '',
              secondaryPhone: legacy.telefonoSecundario || '',
              email: legacy.emailContacto || ''
            };
            const legacyIntegrations = {
              openaiApiKey: legacy.openAIKey || '',
              deepseekKey: legacy.deepseekKey || '',
              perplexityKey: legacy.perplexityKey || '',
              emailServiceProvider: legacy.emailServiceProvider || '',
              emailApiUser: legacy.emailApiUser || '',
              emailApiKey: legacy.emailApiKey || '',
              whatsappApiUrl: legacy.whatsappApiUrl || '',
              whatsappApiKey: legacy.whatsappApiKey || '',
              telegramBotToken: legacy.telegramBotToken || '',
              telegramChatId: legacy.telegramChatId || ''
            };
            // Build minimal payload with only non-empty groups
            const payload = {};
            if (Object.values(legacyLabInfo).some(v => (v ?? '') !== '')) payload.labInfo = legacyLabInfo;
            if (Object.values(legacyIntegrations).some(v => (v ?? '') !== '')) payload.integrations = legacyIntegrations;
            if (Object.keys(payload).length > 0) {
              if (process.env.NODE_ENV !== 'production') {
                console.log('[SettingsContext] Migrating legacy localStorage -> /api/config', Object.keys(payload));
              }
              const updated = await apiClient.patch('/config', payload);
              if (!abortController.signal.aborted && updated) {
                processAndSetSettings(updated);
              }
            }
            try { localStorage.setItem(migratedKey, '1'); } catch {}
          }
        } catch (migErr) {
          console.warn('[SettingsContext] legacy migration failed (continuing):', migErr);
        }
      }
    } catch (error) {
      if (abortController.signal.aborted) return;
      if (error.name !== 'AbortError') {
        console.error('Error cargando configuración', error);
        toast({
          title: 'Error de Configuración',
          description: 'No se pudo cargar la configuración. Se usará la última versión guardada.',
          variant: 'destructive'
        });
        if (!settings) setSettings(defaultSettings);
      }
    } finally {
      if (!abortController.signal.aborted) {
        setIsLoading(false);
        setIsInitialized(true);
      }
    }
  }, [user, session, toast, settings, processAndSetSettings]);

  useEffect(() => {
    const abortController = new AbortController();
    if (!authLoading) {
      fetchSettings(abortController);
    }
    return () => {
        if (!abortController.signal.aborted) {
            try {
              abortController.abort("cleanup");
            } catch (e) {
              // Ignore any errors from aborting, which can happen in some environments.
            }
        }
    };
  }, [authLoading, user, session]);

  const updateSettings = async (newSettings) => {
    console.log('[SettingsContext] updateSettings START', {
      hasUser: !!user,
      hasSession: !!session,
      hasSettings: !!settings,
      hasId: !!(settings && settings.id),
      incomingKeys: newSettings ? Object.keys(newSettings) : []
    });
    if (!isInitialized) {
      console.warn('[SettingsContext] updateSettings BLOCKED: settings not initialized yet');
      toast({ title: 'Configuración cargando', description: 'Espera a que se cargue antes de guardar.', variant: 'destructive' });
      throw new Error('Settings not initialized');
    }
    if (!user) {
      console.warn('[SettingsContext] updateSettings ABORT no user');
      toast({ title: 'Error', description: 'No hay usuario autenticado.', variant: 'destructive' });
      throw new Error('User not authenticated');
    }
    // Permitimos continuar aunque falte settings.id: el backend PATCH auto-crea la fila si no existe.
    if (!settings) {
      console.warn('[SettingsContext] updateSettings proceeding with empty baseline (no settings yet)');
    }

    setIsLoading(true);
    const previousSettings = settings ? { ...settings } : {};
    const baseline = settings || {};
    const mergedLocalSettings = deepmerge(baseline, newSettings);

    // Preservar secretos en memoria si el valor entrante es cadena vacía (interpreta como "no cambiar")
    const secretIntegrationFields = ['openaiApiKey','deepseekKey','perplexityKey','emailApiKey','whatsappApiKey','telegramBotToken'];
    if (mergedLocalSettings.integrations && baseline.integrations) {
      for (const s of secretIntegrationFields) {
        const incoming = mergedLocalSettings.integrations[s];
        const prev = baseline.integrations[s];
        if (incoming === '' && prev) {
          mergedLocalSettings.integrations[s] = prev;
        }
      }
    }

    mergedLocalSettings.regionalSettings.timeZone = "America/Hermosillo";

    // Reflejar inmediatamente en UI el estado consolidado con secretos preservados
    setSettings(mergedLocalSettings);

    try {
      const payload = {};
      const baselineForDiff = settings || {};
      const shallowEqual = (a,b) => {
        try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
      };
      const secretIntegrationFields = ['openaiApiKey','deepseekKey','perplexityKey','emailApiKey','whatsappApiKey','telegramBotToken'];
      for (const key in frontendToDbMapping) {
        if (!Object.prototype.hasOwnProperty.call(mergedLocalSettings, key)) continue;
        const newVal = mergedLocalSettings[key];
        const oldVal = baselineForDiff[key];
        if (shallowEqual(newVal, oldVal)) continue; // no cambio
        if (key === 'integrations' && newVal && typeof newVal === 'object') {
          const cleaned = { ...newVal };
          for (const s of secretIntegrationFields) {
            if (cleaned[s] === '' && oldVal && oldVal[s]) {
              // Evitar sobreescribir secretos existentes con cadena vacía (interpreta vacía como "no tocar").
              delete cleaned[s];
            }
          }
          // Si tras filtrar no hay cambios reales frente a oldVal, saltar.
          if (shallowEqual(cleaned, oldVal)) continue;
          // Permitir borrado explícito usando null.
          payload[key] = cleaned;
        } else {
          payload[key] = newVal;
        }
      }
      if (Object.keys(payload).length === 0) {
        console.log('[SettingsContext] updateSettings: no diff -> skip PATCH');
        setIsLoading(false);
        // Devolver el estado ya consolidado (con secretos preservados) para evitar que la UI muestre vacío
        return mergedLocalSettings;
      }
      console.log('[SettingsContext] PATCH /config - BEFORE', {
        payloadKeys: Object.keys(payload),
        integrations: payload.integrations ? { ...payload.integrations, openaiApiKeyPreview: payload.integrations.openaiApiKey ? payload.integrations.openaiApiKey.slice(0,8)+'...' : '' } : undefined
      });
  const data = await apiClient.patch('/config', payload);
      console.log('[SettingsContext] PATCH /config - AFTER response', {
        updated_at: data.updated_at,
        integrations: data.integrations ? {
          hasOpenAi: !!data.integrations.openaiApiKey,
          openaiApiKeyPreview: data.integrations.openaiApiKey ? data.integrations.openaiApiKey.slice(0,8)+'...' : ''
        } : undefined
      });
      const finalSettings = processAndSetSettings(data);
  console.log('[SettingsContext] updateSettings DONE', { finalHasOpenAi: !!finalSettings.integrations?.openaiApiKey });
      toast({
        title: 'Éxito',
        description: 'La configuración ha sido guardada correctamente.',
        className: 'bg-green-100 dark:bg-green-800 border-green-500'
      });
      return finalSettings;
    } catch (error) {
      setSettings(previousSettings);
      console.error('Error updating settings:', error);
      toast({
        title: 'Error al Guardar',
        description: 'No se pudo guardar la configuración. Los cambios han sido revertidos.',
        variant: 'destructive'
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const value = {
    settings,
    isLoading: isLoading || !isInitialized,
    updateSettings,
    isInitialized,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};