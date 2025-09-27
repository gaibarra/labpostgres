import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion } from 'framer-motion';
import { Settings2, Save, Info, FileText as FileTextIcon, Palette, MapPin, Loader2, Share2, HelpCircle, ShieldAlert } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { logAuditEvent } from '@/lib/auditUtils';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';

import LabInfoSettings from '@/components/modules/administration/general_settings/LabInfoSettings';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import ReportSettingsTab from '@/components/modules/administration/general_settings/ReportSettingsTab';
import UISettings from '@/components/modules/administration/general_settings/UISettings';
import RegionalSettingsTab from '@/components/modules/administration/general_settings/RegionalSettingsTab';
import IntegrationsSettingsTab from '@/components/modules/administration/general_settings/IntegrationsSettingsTab';
import HelpDialog from '@/components/modules/administration/general_settings/HelpDialog';

const GeneralSettings = ({ initialActiveTab = "labInfo" }) => {
  const { toast } = useToast();
  const { user, loading: isAuthLoading } = useAuth();
  const { settings, isLoading: isLoadingSettings, updateSettings } = useSettings();
  
  const [localSettings, setLocalSettings] = useState(null);
  const [activeTab, setActiveTab] = useState(initialActiveTab);
  const [isSaving, setIsSaving] = useState(false);
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);
  const [labInfoEditMode, setLabInfoEditMode] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingSave, setPendingSave] = useState(false);

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

  const doSave = useCallback(async (payload) => {
    setIsSaving(true);
    try {
      const result = await updateSettings(payload);
      if (!result) {
        toast({ title: "Error", description: "El backend no devolvió configuración actualizada.", variant: 'destructive' });
        return;
      }
      toast({ title: "Éxito", description: "¡Configuración guardada correctamente!" });
      logAuditEvent('ConfiguracionGeneralGuardada', { settingsChanged: activeTab }, user.id)
        .catch(err => console.warn('Audit log failed', err));
      if (activeTab === 'labInfo') {
        setLabInfoEditMode(false);
      }
    } catch (error) {
      console.error('Error guardando configuración:', error);
      toast({ title: "Error al guardar", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }, [updateSettings, toast, activeTab, user]);

  const handleSaveChanges = useCallback(async () => {
    if (!localSettings || !user) return;
    const payload = { ...localSettings };
    // Detectar cambios reales en labInfo cuando en modo edición
    if (activeTab === 'labInfo' && labInfoEditMode) {
      payload.forceUnlock = true;
      // Minimiza confirmaciones innecesarias (si no hay diff no mostramos confirm)
      try {
        const original = settings.labInfo || {};
        const modified = payload.labInfo || {};
        const changed = Object.keys(modified).some(k => (modified[k] || '') !== (original[k] || ''));
        if (!changed) {
          // Nada cambió, guarda directo (aunque tendrá forceUnlock no dañará)
          return doSave(payload);
        }
      } catch {}
      setPendingSave(true);
      setConfirmOpen(true);
      return;
    }
    // Otros tabs guardan directo
    doSave(payload);
  }, [localSettings, user, activeTab, labInfoEditMode, settings, doSave]);

  if (isLoadingSettings || !localSettings || isAuthLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        <p className="ml-4 text-slate-600 dark:text-slate-400">Cargando configuración...</p>
      </div>
    );
  }
  
  const tabComponents = {
    labInfo: (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400">Protegido</Badge>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
              Los datos del laboratorio están bloqueados. Pulsa "Editar" para habilitar cambios (se enviará forceUnlock).
            </p>
          </div>
          <div className="flex gap-2">
            {!labInfoEditMode && (
              <Button variant="outline" size="sm" onClick={() => setLabInfoEditMode(true)}>Editar</Button>
            )}
            {labInfoEditMode && (
              <Button variant="ghost" size="sm" onClick={() => { setLocalSettings(s=>({ ...s, labInfo: settings.labInfo })); setLabInfoEditMode(false); }}>Cancelar</Button>
            )}
          </div>
        </div>
        <div className={labInfoEditMode ? '' : 'pointer-events-none opacity-70 select-none'}>
          <LabInfoSettings settings={localSettings} handleInputChange={handleInputChange} />
          {!labInfoEditMode && <p className="text-xs mt-2 text-slate-500">Modo lectura. Haz clic en "Editar" para modificar.</p>}
        </div>
      </div>
    ),
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

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400"><ShieldAlert className="h-5 w-5"/>Confirmar Cambios Sensibles</DialogTitle>
            <DialogDescription>
              Estás a punto de modificar datos críticos del laboratorio. Esto requiere confirmación explícita.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <p>Los cambios se aplicarán de forma inmediata y quedarán registrados.</p>
            <ul className="list-disc ml-5">
              <li>Verifica que los datos fiscales y de contacto sean correctos.</li>
              <li>Evita editar sin necesidad; estos campos están protegidos.</li>
            </ul>
          </div>
          <DialogFooter className="pt-4 flex gap-2">
            <Button variant="outline" onClick={() => { setConfirmOpen(false); setPendingSave(false); }} disabled={isSaving}>Cancelar</Button>
            <Button onClick={() => {
              setConfirmOpen(false);
              if (pendingSave) {
                const payload = { ...localSettings, forceUnlock: true };
                doSave(payload);
                setPendingSave(false);
              }
            }} disabled={isSaving} className="bg-red-600 hover:bg-red-700 text-white">Confirmar y Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default GeneralSettings;