import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion } from 'framer-motion';
import { Settings2, Save, Info, FileText as FileTextIcon, Palette, MapPin, Loader2, Share2, HelpCircle } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { logAuditEvent } from '@/lib/auditUtils';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';

import LabInfoSettings from '@/components/modules/administration/general_settings/LabInfoSettings';
import ReportSettingsTab from '@/components/modules/administration/general_settings/ReportSettingsTab';
import UISettings from '@/components/modules/administration/general_settings/UISettings';
import RegionalSettingsTab from '@/components/modules/administration/general_settings/RegionalSettingsTab';
import IntegrationsSettingsTab from '@/components/modules/administration/general_settings/IntegrationsSettingsTab';
import HelpDialog from '@/components/modules/administration/general_settings/HelpDialog';

const GeneralSettings = () => {
  const { toast } = useToast();
  const { user, loading: isAuthLoading } = useAuth();
  const { settings, isLoading: isLoadingSettings, updateSettings } = useSettings();
  
  const [localSettings, setLocalSettings] = useState(null);
  const [activeTab, setActiveTab] = useState("labInfo");
  const [isSaving, setIsSaving] = useState(false);
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);

  useEffect(() => {
    if (settings) {
      setLocalSettings(JSON.parse(JSON.stringify(settings)));
    }
  }, [settings]);

  const handleInputChange = (category, field, value) => {
    setLocalSettings(prev => {
      if (!prev) return null;
      const newSettings = { ...prev };
      if (!newSettings[category]) {
        newSettings[category] = {};
      }
      newSettings[category] = { ...newSettings[category], [field]: value };
      return newSettings;
    });
  };
  
  const handleCheckboxChange = (category, field, checked) => {
    handleInputChange(category, field, Boolean(checked));
  };

  const handleSaveChanges = useCallback(async () => {
    if (!localSettings || !user) return;
    setIsSaving(true);
    try {
  console.log('[GeneralSettings] Guardar Cambios - BEFORE', { activeTab, settingsToSave: localSettings });
      const result = await updateSettings(localSettings);
      console.log('[GeneralSettings] Guardar Cambios - AFTER SUCCESS result', { hasResult: !!result, hasOpenAi: !!result?.integrations?.openaiApiKey });
      if (!result) {
        toast({ title: "Error", description: "El backend no devolvió configuración actualizada.", variant: 'destructive' });
        return;
      }
      toast({ title: "Éxito", description: "¡Configuración guardada correctamente!" });
      logAuditEvent('ConfiguracionGeneralGuardada', { settingsChanged: activeTab }, user.id)
        .catch(err => console.warn('Audit log failed', err));
    } catch (error) {
      console.error('Error guardando configuración:', error);
  console.log('[GeneralSettings] Guardar Cambios - AFTER ERROR', error);
      toast({ title: "Error al guardar", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }, [localSettings, user, updateSettings, toast, activeTab]);

  if (isLoadingSettings || !localSettings || isAuthLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        <p className="ml-4 text-slate-600 dark:text-slate-400">Cargando configuración...</p>
      </div>
    );
  }
  
  const tabComponents = {
    labInfo: <LabInfoSettings settings={localSettings} handleInputChange={handleInputChange} />,
    reportSettings: <ReportSettingsTab settings={localSettings} handleInputChange={handleInputChange} handleCheckboxChange={handleCheckboxChange} />,
    uiSettings: <UISettings settings={localSettings} handleInputChange={handleInputChange} handleCheckboxChange={handleCheckboxChange} />,
    regionalSettings: <RegionalSettingsTab settings={localSettings} handleInputChange={handleInputChange} />,
    integrations: <IntegrationsSettingsTab settings={localSettings} handleInputChange={handleInputChange} />,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <HelpDialog open={isHelpDialogOpen} onOpenChange={setIsHelpDialogOpen} />
      <Card className="shadow-xl glass-card overflow-hidden">
        <CardHeader className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-900/70 dark:via-purple-900/70 dark:to-pink-900/70 p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center">
              <Settings2 className="h-10 w-10 mr-4 text-indigo-600 dark:text-indigo-400" />
              <div>
                <CardTitle className="text-3xl font-bold text-indigo-700 dark:text-indigo-300">
                  Configuración General
                </CardTitle>
                <CardDescription className="text-slate-600 dark:text-slate-400">
                  Ajusta parámetros globales del sistema y preferencias operativas.
                </CardDescription>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setIsHelpDialogOpen(true)}>
              <HelpCircle className="h-6 w-6 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 mb-6">
              <TabsTrigger value="labInfo" className="flex items-center gap-2"><Info className="h-4 w-4"/>Info. Lab</TabsTrigger>
              <TabsTrigger value="reportSettings" className="flex items-center gap-2"><FileTextIcon className="h-4 w-4"/>Reportes</TabsTrigger>
              <TabsTrigger value="uiSettings" className="flex items-center gap-2"><Palette className="h-4 w-4"/>Interfaz</TabsTrigger>
              <TabsTrigger value="regionalSettings" className="flex items-center gap-2"><MapPin className="h-4 w-4"/>Regional</TabsTrigger>
              <TabsTrigger value="integrations" className="flex items-center gap-2"><Share2 className="h-4 w-4"/>Integraciones</TabsTrigger>
            </TabsList>
            
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
            >
              {localSettings && Object.entries(tabComponents).map(([tabKey, TabComponent]) => (
                 <TabsContent key={tabKey} value={tabKey} forceMount={activeTab === tabKey} hidden={activeTab !== tabKey}>
                    {TabComponent}
                 </TabsContent>
              ))}
            </motion.div>
            
          </Tabs>
        </CardContent>
        <CardFooter className="flex justify-end p-6">
          <Button onClick={handleSaveChanges} disabled={isSaving} className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {isSaving ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
};

export default GeneralSettings;