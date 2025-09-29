import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from 'framer-motion';
import { Mail, ListChecks, FileText as FileTextIcon, Send, BarChart2, Users, Loader2 } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { logAuditEvent } from '@/lib/auditUtils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, parseISO } from 'date-fns';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';

import CampaignsTab from './email_marketing/CampaignsTab';
import ListsTab from './email_marketing/ListsTab';
import TemplatesTab from './email_marketing/TemplatesTab';
import SubscribersTab from './email_marketing/SubscribersTab';
import ManageListSubscribersModal from './email_marketing/ManageListSubscribersModal';
import CampaignFormDialog from './email_marketing/CampaignFormDialog';
import TemplateFormDialog from './email_marketing/TemplateFormDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const initialCampaignForm = {
  id: null, name: '', subject: '', listId: '', templateId: '', sendDateTime: null, status: 'Borrador',
  metrics: { sent: 0, opened: 0, clicked: 0, openRate: '0%', clickRate: '0%' }
};
const initialListForm = { id: null, name: ''};
const initialTemplateForm = { id: null, name: '', subject: '', body: 'Hola {{nombre_suscriptor}},\n\nEste es un email de prueba.\n\nSaludos,\nEquipo de Marketing' };

const EmailMarketing = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('campaigns');
  
  const [campaigns, setCampaigns] = useState([]);
  const [lists, setLists] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [isLoading, setIsLoading] = useState({ campaigns: false, lists: false, templates: false, subscribers: false });

  const [isCampaignFormOpen, setIsCampaignFormOpen] = useState(false);
  const [currentCampaign, setCurrentCampaign] = useState(initialCampaignForm);
  const [campaignFormMode, setCampaignFormMode] = useState('new');

  const [isListFormOpen, setIsListFormOpen] = useState(false);
  const [currentList, setCurrentList] = useState(initialListForm);
  const [listFormMode, setListFormMode] = useState('new');

  const [isTemplateFormOpen, setIsTemplateFormOpen] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState(initialTemplateForm);
  const [templateFormMode, setTemplateFormMode] = useState('new');
  const [pendingDeleteTemplate, setPendingDeleteTemplate] = useState(null);
  const [templateUsageCount, setTemplateUsageCount] = useState(null);
  const [confirmNameInput, setConfirmNameInput] = useState('');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedCampaignDetails, setSelectedCampaignDetails] = useState(null);

  const [isManageSubscribersModalOpen, setIsManageSubscribersModalOpen] = useState(false);
  const [listToManage, setListToManage] = useState(null);

  const setLoadingState = (key, value) => setIsLoading(prev => ({ ...prev, [key]: value }));

  const loadSubscribers = useCallback(async () => {
    setLoadingState('subscribers', true);
    try {
      const data = await apiClient.get('/marketing/email/subscribers');
      setSubscribers(data);
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudieron cargar los suscriptores.', variant: 'destructive' });
    } finally { setLoadingState('subscribers', false); }
  }, [toast]);

  const loadLists = useCallback(async () => {
    setLoadingState('lists', true);
    try {
      const data = await apiClient.get('/marketing/email/lists');
      const formattedLists = data.map(list => ({ id: list.id, name: list.name, subscriberCount: parseInt(list.subscriber_count,10) || 0 }));
      setLists(formattedLists);
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudieron cargar las listas.', variant: 'destructive' });
    } finally { setLoadingState('lists', false); }
  }, [toast]);

  const loadData = useCallback(async () => {
    setLoadingState('campaigns', true);
    try {
      const data = await apiClient.get('/marketing/email/campaigns');
      setCampaigns(data.map(c => ({
        ...initialCampaignForm,
        ...c,
        id: c.id,
        sendDateTime: c.send_date_time ? parseISO(c.send_date_time) : null,
        metrics: c.metrics || initialCampaignForm.metrics
      })));
    } catch (e) {
      toast({ title: 'Error', description: 'No se pudieron cargar las campañas.', variant: 'destructive' });
    } finally { setLoadingState('campaigns', false); }

    loadLists();
    loadSubscribers();

    setLoadingState('templates', true);
    try {
      const tpls = await apiClient.get('/marketing/email/templates');
      setTemplates(tpls.map(t => ({ id: t.id, name: t.name, subject: t.subject, body: t.body })));
    } catch (e) {
      toast({ title: 'Error', description: 'No se pudieron cargar las plantillas.', variant: 'destructive' });
    } finally { setLoadingState('templates', false); }
  }, [loadLists, loadSubscribers, toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const generateId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

  const handleSaveCampaign = async (campaignData, finalSendDateTime) => {
    const payload = {
      name: campaignData.name,
      subject: campaignData.subject,
      body: campaignData.body,
      list_id: campaignData.listId || null,
      template_id: campaignData.templateId || null,
      send_date_time: finalSendDateTime ? format(finalSendDateTime, "yyyy-MM-dd'T'HH:mm:ssXXX") : null,
      status: campaignData.status || 'Borrador',
      metrics: campaignData.metrics || initialCampaignForm.metrics,
    };
    try {
      if (campaignFormMode === 'new') {
        const created = await apiClient.post('/marketing/email/campaigns', payload);
        logAuditEvent('Marketing:EmailCampañaCreada', { campaignId: created.id, name: created.name }, user?.id);
        toast({ title: "Campaña de Email Creada" });
      } else {
        const updated = await apiClient.put(`/marketing/email/campaigns/${campaignData.id}`, payload);
        logAuditEvent('Marketing:EmailCampañaActualizada', { campaignId: updated.id, name: updated.name }, user?.id);
        toast({ title: "Campaña de Email Actualizada" });
      }
      await loadData();
      setIsCampaignFormOpen(false);
    } catch (error) {
      toast({ title: 'Error guardando campaña', description: error.message, variant: 'destructive' });
    }
  };

  const handleSaveList = async () => {
    if (!currentList.name) { toast({ title: 'Error', description: 'El nombre de la lista es obligatorio.', variant: 'destructive' }); return; }
    setLoadingState('lists', true);
    try {
      if (listFormMode === 'new') {
        const data = await apiClient.post('/marketing/email/lists', { name: currentList.name });
        logAuditEvent('Marketing:EmailListaCreada', { listId: data.id, name: data.name }, user?.id);
        toast({ title: 'Lista de Suscriptores Creada' });
      } else {
        const data = await apiClient.put(`/marketing/email/lists/${currentList.id}`, { name: currentList.name });
        logAuditEvent('Marketing:EmailListaActualizada', { listId: data.id, name: data.name }, user?.id);
        toast({ title: 'Lista de Suscriptores Actualizada' });
      }
      await loadLists();
      setIsListFormOpen(false);
      setCurrentList(initialListForm);
    } catch (error) {
      toast({ title: 'Error al guardar la lista', description: error.message, variant: 'destructive' });
    } finally { setLoadingState('lists', false); }
  };

  const handleDeleteList = async (listId, listName) => {
    setLoadingState('lists', true);
    try {
      await apiClient.delete(`/marketing/email/lists/${listId}`);
      logAuditEvent('Marketing:EmailListaEliminada', { listId, name: listName }, user?.id);
      toast({ title: 'Lista Eliminada', description: `La lista "${listName}" ha sido eliminada.`, variant: 'destructive' });
      await loadLists();
    } catch (error) {
      toast({ title: 'Error al eliminar la lista', description: error.message, variant: 'destructive' });
    } finally { setLoadingState('lists', false); }
  };

  const handleSaveTemplate = async (templateData) => {
    if (!templateData.name || !templateData.subject || !templateData.body) {
      toast({ title: "Error", description: "Nombre, asunto y cuerpo son obligatorios para la plantilla.", variant: "destructive" });
      return;
    }
    try {
      if (templateFormMode === 'new') {
        const created = await apiClient.post('/marketing/email/templates', {
          name: templateData.name, subject: templateData.subject, body: templateData.body
        });
        logAuditEvent('Marketing:EmailPlantillaCreada', { templateId: created.id, name: created.name }, user?.id);
        toast({ title: "Plantilla de Email Creada" });
      } else {
        const updated = await apiClient.put(`/marketing/email/templates/${templateData.id}`, {
          name: templateData.name, subject: templateData.subject, body: templateData.body
        });
        logAuditEvent('Marketing:EmailPlantillaActualizada', { templateId: updated.id, name: updated.name }, user?.id);
        toast({ title: "Plantilla de Email Actualizada" });
      }
      await loadData();
      setIsTemplateFormOpen(false);
    } catch (error) {
      toast({ title: 'Error guardando plantilla', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteTemplate = async (templateId, templateName) => {
    try {
      await apiClient.delete(`/marketing/email/templates/${templateId}`);
      logAuditEvent('Marketing:EmailPlantillaEliminada', { templateId, name: templateName }, user?.id);
      toast({ title: 'Plantilla Eliminada', description: `La plantilla "${templateName}" ha sido eliminada.`, variant: 'destructive' });
      // Optimistic local removal
      setTemplates(prev => prev.filter(t => t.id !== templateId));
      setPendingDeleteTemplate(null);
  setTemplateUsageCount(null);
  setConfirmNameInput('');
    } catch (e) {
      toast({ title: 'Error eliminando plantilla', description: e.message, variant: 'destructive' });
    }
  };
  
  const openCampaignForm = (mode = 'new', campaign = null) => {
    setCampaignFormMode(mode);
    if (mode === 'edit' && campaign) {
      setCurrentCampaign({ ...initialCampaignForm, ...campaign, metrics: campaign.metrics || initialCampaignForm.metrics });
    } else {
      setCurrentCampaign(initialCampaignForm);
    }
    setIsCampaignFormOpen(true);
  };

  const openListForm = (mode = 'new', list = null) => {
    setListFormMode(mode);
    setCurrentList(mode === 'edit' && list ? { ...initialListForm, ...list } : initialListForm);
    setIsListFormOpen(true);
  };

  const openTemplateForm = (mode = 'new', template = null) => {
    setTemplateFormMode(mode);
    setCurrentTemplate(mode === 'edit' && template ? { ...initialTemplateForm, ...template } : initialTemplateForm);
    setIsTemplateFormOpen(true);
  };

  const handleViewCampaignDetails = (campaign) => {
    setSelectedCampaignDetails(campaign);
    setIsDetailsModalOpen(true);
  };

  const openManageSubscribersModal = (list) => {
    setListToManage(list);
    setIsManageSubscribersModalOpen(true);
  };
  
  const anyLoading = Object.values(isLoading).some(Boolean);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="space-y-6">
      <Card className="shadow-xl glass-card overflow-hidden">
        <CardHeader className="bg-gradient-to-br from-theme-celestial/20 via-theme-powder/20 to-theme-periwinkle/20 dark:from-theme-celestial/30 dark:via-theme-powder/30 dark:to-theme-periwinkle/30 p-6">
          <div className="flex items-center">
            <Mail className="h-10 w-10 mr-4 text-theme-celestial dark:text-theme-celestial-light" />
            <div>
              <CardTitle className="text-3xl font-bold text-theme-midnight dark:text-theme-powder">Email Marketing</CardTitle>
              <CardDescription className="text-theme-davy dark:text-theme-powder/80">Crea, gestiona y envía campañas de correo electrónico.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <Tabs value={activeTab} onValueChange={(newTab) => { setActiveTab(newTab); setSearchTerm(''); }} className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="campaigns" className="flex items-center gap-2"><Send className="h-4 w-4"/>Campañas</TabsTrigger>
              <TabsTrigger value="lists" className="flex items-center gap-2"><ListChecks className="h-4 w-4"/>Listas</TabsTrigger>
              <TabsTrigger value="subscribers" className="flex items-center gap-2"><Users className="h-4 w-4"/>Suscriptores</TabsTrigger>
              <TabsTrigger value="templates" className="flex items-center gap-2"><FileTextIcon className="h-4 w-4"/>Plantillas</TabsTrigger>
            </TabsList>
            {anyLoading && activeTab !== 'subscribers' && (
              <div className="flex justify-center items-center h-[400px]">
                <Loader2 className="h-10 w-10 animate-spin text-theme-celestial" />
              </div>
            )}
            {!anyLoading || activeTab === 'subscribers' ? (
                <>
                  <TabsContent value="campaigns">
                    <CampaignsTab
                      campaigns={campaigns}
                      searchTerm={searchTerm}
                      setSearchTerm={setSearchTerm}
                      openCampaignForm={openCampaignForm}
                      handleViewCampaignDetails={handleViewCampaignDetails}
                    />
                  </TabsContent>
                  <TabsContent value="lists">
                    <ListsTab
                      lists={lists}
                      searchTerm={searchTerm}
                      setSearchTerm={setSearchTerm}
                      openListForm={openListForm}
                      handleDeleteList={handleDeleteList}
                      openManageSubscribersModal={openManageSubscribersModal}
                    />
                  </TabsContent>
                  <TabsContent value="subscribers">
                     <SubscribersTab 
                        subscribers={subscribers}
                        loadSubscribers={loadSubscribers}
                        isLoading={isLoading.subscribers}
                     />
                  </TabsContent>
                  <TabsContent value="templates">
                    <TemplatesTab
                      templates={templates}
                      searchTerm={searchTerm}
                      setSearchTerm={setSearchTerm}
                      openTemplateForm={openTemplateForm}
                      onRequestDelete={async (tpl)=> {
                        setPendingDeleteTemplate(tpl);
                        setTemplateUsageCount(null);
                        setConfirmNameInput('');
                        try {
                          const usage = await apiClient.get(`/marketing/email/templates/${tpl.id}/usage`);
                          setTemplateUsageCount(usage.count);
                        } catch { setTemplateUsageCount(0); }
                      }}
                    />
                  </TabsContent>
                </>
             ) : null}
          </Tabs>
        </CardContent>
      </Card>

      <CampaignFormDialog
        isOpen={isCampaignFormOpen}
        onOpenChange={setIsCampaignFormOpen}
        onSave={handleSaveCampaign}
        mode={campaignFormMode}
        initialData={currentCampaign}
        lists={lists}
        templates={templates}
      />
      
      <TemplateFormDialog
        isOpen={isTemplateFormOpen}
        onOpenChange={setIsTemplateFormOpen}
        onSave={handleSaveTemplate}
        mode={templateFormMode}
        initialData={currentTemplate}
      />
      
      <Dialog open={isListFormOpen} onOpenChange={(isOpen) => { setIsListFormOpen(isOpen); if (!isOpen) setCurrentList(initialListForm); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{listFormMode === 'new' ? 'Nueva Lista de Suscriptores' : 'Editar Lista'}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div><Label htmlFor="listName">Nombre Lista</Label><Input id="listName" value={currentList.name} onChange={(e) => setCurrentList({...currentList, name: e.target.value})} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsListFormOpen(false)} disabled={isLoading.lists}>Cancelar</Button>
            <Button onClick={handleSaveList} disabled={isLoading.lists}>
              {isLoading.lists ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Guardar Lista'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalles de Campaña: {selectedCampaignDetails?.name}</DialogTitle>
            <DialogDescription>Información y métricas (simuladas) de la campaña de email.</DialogDescription>
          </DialogHeader>
          {selectedCampaignDetails && (
            <ScrollArea className="max-h-[60vh] pr-3">
              <div className="space-y-3 py-2">
                <p><strong>Asunto:</strong> {selectedCampaignDetails.subject}</p>
                <p><strong>Lista:</strong> {lists.find(l => l.id === selectedCampaignDetails.listId)?.name || 'N/A'}</p>
                <p><strong>Plantilla:</strong> {templates.find(t => t.id === selectedCampaignDetails.templateId)?.name || 'N/A'}</p>
                <p><strong>Fecha Envío:</strong> {selectedCampaignDetails.sendDateTime ? format(selectedCampaignDetails.sendDateTime, 'dd/MM/yyyy HH:mm') : 'N/A'}</p>
                <p><strong>Estado:</strong> {selectedCampaignDetails.status}</p>
                <Card className="mt-4 bg-slate-50 dark:bg-theme-davy-dark/30">
                  <CardHeader><CardTitle className="text-md flex items-center"><BarChart2 className="h-5 w-5 mr-2"/>Métricas (Simuladas)</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-2 gap-2 text-sm">
                    <p><strong>Enviados:</strong> {selectedCampaignDetails.metrics.sent.toLocaleString()}</p>
                    <p><strong>Abiertos:</strong> {selectedCampaignDetails.metrics.opened.toLocaleString()}</p>
                    <p><strong>Clics:</strong> {selectedCampaignDetails.metrics.clicked.toLocaleString()}</p>
                    <p><strong>Tasa Apertura:</strong> {selectedCampaignDetails.metrics.openRate}</p>
                    <p><strong>Tasa Clics:</strong> {selectedCampaignDetails.metrics.clickRate}</p>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          )}
          <DialogFooter className="pt-4"><Button onClick={() => setIsDetailsModalOpen(false)}>Cerrar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      
      <ManageListSubscribersModal
        list={listToManage}
        allSubscribers={subscribers}
        isOpen={isManageSubscribersModalOpen}
        onClose={() => setIsManageSubscribersModalOpen(false)}
        onListUpdate={loadLists}
      />

      {/* Delete Template Confirmation Dialog */}
      <Dialog open={!!pendingDeleteTemplate} onOpenChange={(open)=> { if(!open){ setPendingDeleteTemplate(null); setTemplateUsageCount(null); setConfirmNameInput(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar Plantilla</DialogTitle>
            <DialogDescription>
              Esta acción eliminará permanentemente la plantilla
              {pendingDeleteTemplate ? ` "${pendingDeleteTemplate.name}"` : ''}. No se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            {templateUsageCount === null ? (
              <p className="text-muted-foreground">Verificando uso...</p>
            ) : templateUsageCount > 0 ? (
              <p className="text-amber-600 dark:text-amber-400">Esta plantilla está referenciada por {templateUsageCount} campaña(s). Considera desvincularlas antes de eliminar.</p>
            ) : (
              <p>No hay campañas que la referencien.</p>
            )}
            <div>
              <p className="mb-1">Escribe el nombre exacto para confirmar:</p>
              <input
                type="text"
                className="w-full border rounded px-2 py-1 text-sm bg-white dark:bg-slate-800"
                value={confirmNameInput}
                onChange={(e)=> setConfirmNameInput(e.target.value)}
                placeholder={pendingDeleteTemplate?.name || ''}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=> setPendingDeleteTemplate(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={!pendingDeleteTemplate || confirmNameInput !== pendingDeleteTemplate.name} onClick={()=> pendingDeleteTemplate && handleDeleteTemplate(pendingDeleteTemplate.id, pendingDeleteTemplate.name)}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </motion.div>
  );
};

export default EmailMarketing;