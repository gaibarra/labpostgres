import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion } from 'framer-motion';
import { FileText, PlusCircle, Loader2 } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { logAuditEvent } from '@/lib/auditUtils';
// Supabase removed – using REST apiClient
import apiClient from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import TemplateFormDialog from './templates_and_reports/TemplateFormDialog';
import TemplatesTable from './templates_and_reports/TemplatesTable';
import TemplatePreviewDialog from './templates_and_reports/TemplatePreviewDialog';
import { templateTypes, defaultTemplates, availablePlaceholders } from './templates_and_reports/templateData';

const TemplatesAndReports = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(templateTypes[0].value);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState(null);
  const [formMode, setFormMode] = useState('new');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [templateToPreview, setTemplateToPreview] = useState(null);

  const loadTemplates = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.get('/templates');
      if (!data || data.length === 0) {
        // Seed default templates if empty
        await apiClient.post('/templates/seed-defaults', { templates: defaultTemplates });
        logAuditEvent('Sistema:PlantillasPorDefectoCreadas', { count: defaultTemplates.length }, 'Sistema');
        const seeded = await apiClient.get('/templates');
        setTemplates(seeded || []);
      } else {
        setTemplates(data);
      }
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'No se pudieron cargar las plantillas.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleInputChange = (field, value) => {
    setCurrentTemplate(prev => ({ ...prev, [field]: value }));
  };
  
  const handleCheckboxChange = (field, checked) => {
    setCurrentTemplate(prev => ({ ...prev, [field]: checked }));
  };

  const handleSaveTemplate = async () => {
    if (!currentTemplate || !currentTemplate.name || !currentTemplate.type || !currentTemplate.content) {
      toast({ title: "Error", description: "Nombre, tipo y contenido son obligatorios.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    const payload = {
      name: currentTemplate.name,
      type: currentTemplate.type,
      content: currentTemplate.content,
      header: currentTemplate.header,
      footer: currentTemplate.footer,
      is_default: currentTemplate.is_default || false,
      is_system: currentTemplate.is_system || false
    };

    try {
      let saved;
      if (formMode === 'new' || formMode === 'clone') {
        saved = await apiClient.post('/templates', payload);
        logAuditEvent('Administracion:PlantillaCreada', { templateId: saved.id, name: saved.name, type: saved.type }, user?.id);
        toast({ title: 'Plantilla Creada', description: `La plantilla "${saved.name}" ha sido creada.` });
      } else {
        saved = await apiClient.put(`/templates/${currentTemplate.id}`, payload);
        logAuditEvent('Administracion:PlantillaActualizada', { templateId: saved.id, name: saved.name }, user?.id);
        toast({ title: 'Plantilla Actualizada', description: `La plantilla "${saved.name}" ha sido actualizada.` });
      }

      if (saved.is_default) {
        try {
          await apiClient.post(`/templates/${saved.id}/set-default`);
        } catch (e) {
          console.warn('No se pudo establecer como predeterminada:', e);
          toast({ title: 'Advertencia', description: 'No se pudo establecer como predeterminada.', variant: 'destructive' });
        }
      }
      await loadTemplates();
      setIsFormOpen(false);
      setCurrentTemplate(null);
    } catch(e) {
      console.error(e);
      toast({ title: 'Error al guardar', description: e.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const openForm = (mode = 'new', template = null) => {
    setFormMode(mode);
    if (mode === 'edit' && template) {
      setCurrentTemplate({ ...template });
    } else if (mode === 'clone' && template) {
      setCurrentTemplate({ ...template, name: `${template.name} (Copia)`, id: null, is_system: false, is_default: false });
    } else {
      setCurrentTemplate({ name: '', type: activeTab, content: '', header: '', footer: '', is_default: false, is_system: false });
    }
    setIsFormOpen(true);
  };

  const openPreview = (template) => {
    setTemplateToPreview(template);
    setIsPreviewOpen(true);
  };

  const handleDeleteTemplate = async (templateId, templateName) => {
    const templateToDelete = templates.find(t => t.id === templateId);
    if (templateToDelete && templateToDelete.is_system) {
      toast({ title: "Acción no permitida", description: "Las plantillas del sistema no pueden ser eliminadas.", variant: "destructive" });
      return;
    }
    if (templateToDelete && templateToDelete.is_default) {
      toast({ title: "Acción no permitida", description: "No se puede eliminar una plantilla marcada como predeterminada. Cambie la plantilla predeterminada primero.", variant: "destructive" });
      return;
    }

    try {
      await apiClient.delete(`/templates/${templateId}`);
      logAuditEvent('Administracion:PlantillaEliminada', { templateId, name: templateName }, user?.id);
      toast({ title: 'Plantilla Eliminada', description: `La plantilla "${templateName}" ha sido eliminada.` });
      await loadTemplates();
    } catch(e) {
      toast({ title: 'Error al eliminar', description: e.message, variant: 'destructive' });
    }
  };
  
  const handleSetDefault = async (templateId, type) => {
    setIsLoading(true);
    try {
      const data = await apiClient.post(`/templates/${templateId}/set-default`);
      logAuditEvent('Administracion:PlantillaPredeterminadaCambiada', { templateId, name: data.name, type }, user?.id);
      toast({ title: 'Plantilla Predeterminada Actualizada', description: `"${data.name}" es ahora la plantilla predeterminada para ${templateTypes.find(tt => tt.value === type)?.label || type}.` });
      await loadTemplates();
    } catch(e) {
      toast({ title: 'Error', description: `Error al establecer predeterminada: ${e.message}` , variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };
  
  const currentPlaceholders = currentTemplate?.type ? (availablePlaceholders[currentTemplate.type] || []) : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <Card className="shadow-xl glass-card overflow-hidden">
        <CardHeader className="bg-gradient-to-br from-cyan-50 via-sky-50 to-blue-50 dark:from-cyan-900/70 dark:via-sky-900/70 dark:to-blue-900/70 p-6">
          <div className="flex items-center">
            <FileText className="h-10 w-10 mr-4 text-sky-600 dark:text-sky-400" />
            <div>
              <CardTitle className="text-3xl font-bold text-sky-700 dark:text-sky-300">
                Plantillas y Reportes
              </CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400">
                Gestiona plantillas para reportes, consentimientos y otros documentos.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5 mb-6">
              {templateTypes.map(type => (
                <TabsTrigger key={type.value} value={type.value}>{type.label}</TabsTrigger>
              ))}
            </TabsList>
            
            <div className="flex justify-end mb-4">
              <Button onClick={() => openForm('new')} className="bg-gradient-to-r from-sky-500 to-cyan-600 hover:from-sky-600 hover:to-cyan-700 text-white">
                <PlusCircle className="mr-2 h-4 w-4" /> Nueva Plantilla
              </Button>
            </div>

            {templateTypes.map(typeInfo => (
              <TabsContent key={typeInfo.value} value={typeInfo.value}>
                {isLoading ? (
                  <div className="flex justify-center items-center h-[400px]">
                    <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
                  </div>
                ) : (
                  <TemplatesTable
                    templates={templates.filter(t => t.type === activeTab)}
                    isLoading={isLoading}
                    handleSetDefault={handleSetDefault}
                    openForm={openForm}
                    handleDeleteTemplate={handleDeleteTemplate}
                    openPreview={openPreview}
                  />
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {isFormOpen && (
        <TemplateFormDialog
          isOpen={isFormOpen}
          onOpenChange={setIsFormOpen}
          formMode={formMode}
          currentTemplate={currentTemplate}
          handleInputChange={handleInputChange}
          handleCheckboxChange={handleCheckboxChange}
          onSave={handleSaveTemplate}
          isLoading={isLoading}
          templateTypes={templateTypes}
          currentPlaceholders={currentPlaceholders}
        />
      )}

      {isPreviewOpen && templateToPreview && (
        <TemplatePreviewDialog
          isOpen={isPreviewOpen}
          onOpenChange={setIsPreviewOpen}
          template={templateToPreview}
        />
      )}
    </motion.div>
  );
};

export default TemplatesAndReports;