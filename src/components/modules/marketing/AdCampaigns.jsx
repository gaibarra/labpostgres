import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { motion } from 'framer-motion';
import { Megaphone, PlusCircle, Edit3, Search, Eye, Archive, Loader2 } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { logAuditEvent } from '@/lib/auditUtils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DatePicker } from '@/components/ui/datepicker'; 
import { format, parseISO } from 'date-fns';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';

const initialCampaignForm = {
  id: null,
  name: '',
  platform: 'Google Ads',
  start_date: null,
  end_date: null,
  budget: '',
  objectives: '',
  status: 'Planificada',
  notes: '',
  kpis: {
    impressions: 0,
    clicks: 0,
    conversions: 0,
    ctr: '0%',
    cpc: '$0.00',
    cpa: '$0.00',
  }
};

const campaignPlatforms = ['Google Ads', 'Facebook Ads', 'Instagram Ads', 'LinkedIn Ads', 'TikTok Ads', 'X Ads (Twitter)', 'Otra'];
const campaignStatuses = ['Planificada', 'Activa', 'Pausada', 'Finalizada', 'Archivada'];

const AdCampaigns = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentCampaign, setCurrentCampaign] = useState(initialCampaignForm);
  const [formMode, setFormMode] = useState('new'); 
  const [searchTerm, setSearchTerm] = useState('');
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedCampaignDetails, setSelectedCampaignDetails] = useState(null);

  const loadCampaigns = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.get('/marketing/ad-campaigns');
      setCampaigns(data.map(c => ({
        ...c,
        start_date: c.start_date ? parseISO(c.start_date) : null,
        end_date: c.end_date ? parseISO(c.end_date) : null,
        budget: c.budget
      })));
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudieron cargar las campañas.', variant: 'destructive' });
    } finally { setIsLoading(false); }
  }, [toast]);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  const handleSaveCampaign = async () => {
    if (!currentCampaign.name || !currentCampaign.platform || !currentCampaign.start_date || !currentCampaign.budget) {
      toast({ title: "Error", description: "Nombre, plataforma, fecha de inicio y presupuesto son obligatorios.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    const campaignData = {
      name: currentCampaign.name,
      platform: currentCampaign.platform,
      start_date: format(currentCampaign.start_date, 'yyyy-MM-dd'),
      end_date: currentCampaign.end_date ? format(currentCampaign.end_date, 'yyyy-MM-dd') : null,
      budget: parseFloat(currentCampaign.budget) || 0,
      objectives: currentCampaign.objectives,
      status: currentCampaign.status,
      notes: currentCampaign.notes,
      kpis: currentCampaign.kpis,
      user_id: user.id,
    };

    try {
      if (formMode === 'new') {
        await apiClient.post('/marketing/ad-campaigns', campaignData);
        await logAuditEvent('Marketing:CampañaCreada', { name: campaignData.name });
        toast({ title: 'Campaña Creada', description: `La campaña "${campaignData.name}" ha sido creada.` });
      } else {
        await apiClient.put(`/marketing/ad-campaigns/${currentCampaign.id}`, campaignData);
        await logAuditEvent('Marketing:CampañaActualizada', { campaignId: currentCampaign.id, name: campaignData.name });
        toast({ title: 'Campaña Actualizada', description: `La campaña "${campaignData.name}" ha sido actualizada.` });
      }
      setIsFormOpen(false);
      setCurrentCampaign(initialCampaignForm);
      loadCampaigns();
    } catch (error) {
      toast({ title: 'Error al guardar', description: error.message, variant: 'destructive' });
    } finally { setIsLoading(false); }
  };

  const handleInputChange = (field, value) => {
    setCurrentCampaign(prev => ({ ...prev, [field]: value }));
  };
  
  const handleDateChange = (field, date) => {
    setCurrentCampaign(prev => ({ ...prev, [field]: date }));
  };

  const openForm = (mode = 'new', campaign = null) => {
    setFormMode(mode);
    if (mode === 'edit' && campaign) {
      setCurrentCampaign({ 
        ...initialCampaignForm, 
        ...campaign,
        budget: campaign.budget?.toString() || '',
      });
    } else {
      setCurrentCampaign(initialCampaignForm);
    }
    setIsFormOpen(true);
  };

  const handleViewDetails = (campaign) => {
    setSelectedCampaignDetails(campaign);
    setIsDetailsModalOpen(true);
  };

  const handleArchiveCampaign = async (campaignId) => {
    const campaignToArchive = campaigns.find(c => c.id === campaignId);
    if (!campaignToArchive) return;
    setIsLoading(true);
    try {
      await apiClient.post(`/marketing/ad-campaigns/${campaignId}/archive`);
      await logAuditEvent('Marketing:CampañaArchivada', { campaignId });
      toast({ title: 'Campaña Archivada', description: `La campaña "${campaignToArchive.name}" ha sido archivada.` });
      loadCampaigns();
    } catch (error) {
      toast({ title: 'Error al archivar', description: error.message, variant: 'destructive' });
    } finally { setIsLoading(false); }
  };
  
  const filteredCampaigns = campaigns.filter(campaign =>
    campaign.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    campaign.platform?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    campaign.status?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <Card className="shadow-xl glass-card overflow-hidden">
        <CardHeader className="bg-gradient-to-br from-theme-celestial/20 via-theme-powder/20 to-theme-periwinkle/20 dark:from-theme-celestial/30 dark:via-theme-powder/30 dark:to-theme-periwinkle/30 p-6">
          <div className="flex items-center">
            <Megaphone className="h-10 w-10 mr-4 text-theme-celestial dark:text-theme-celestial-light" />
            <div>
              <CardTitle className="text-3xl font-bold text-theme-midnight dark:text-theme-powder">
                Campañas de Publicidad
              </CardTitle>
              <CardDescription className="text-theme-davy dark:text-theme-powder/80">
                Gestiona y analiza tus campañas publicitarias en diversas plataformas.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
            <div className="relative w-full sm:w-1/3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-theme-davy/70" />
              <Input
                type="text"
                placeholder="Buscar campañas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white dark:bg-theme-davy-dark/50 border-theme-powder dark:border-theme-davy"
              />
            </div>
            <Button onClick={() => openForm('new')} className="w-full sm:w-auto bg-gradient-to-r from-theme-celestial to-theme-midnight hover:from-theme-celestial-dark hover:to-theme-midnight-dark text-white">
              <PlusCircle className="mr-2 h-4 w-4" /> Nueva Campaña
            </Button>
          </div>

          <ScrollArea className="h-[450px] rounded-md border border-theme-powder dark:border-theme-davy">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Plataforma</TableHead>
                  <TableHead>Fechas</TableHead>
                  <TableHead>Presupuesto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                ) : filteredCampaigns.length > 0 ? filteredCampaigns.map(campaign => (
                  <TableRow key={campaign.id}>
                    <TableCell className="font-medium">{campaign.name}</TableCell>
                    <TableCell>{campaign.platform}</TableCell>
                    <TableCell>
                      {campaign.start_date ? format(campaign.start_date, 'dd/MM/yy') : 'N/A'} - {campaign.end_date ? format(campaign.end_date, 'dd/MM/yy') : 'N/A'}
                    </TableCell>
                    <TableCell>${campaign.budget?.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        campaign.status === 'Activa' ? 'bg-green-100 text-green-700 dark:bg-green-700/30 dark:text-green-300' :
                        campaign.status === 'Planificada' ? 'bg-blue-100 text-blue-700 dark:bg-blue-700/30 dark:text-blue-300' :
                        campaign.status === 'Pausada' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-700/30 dark:text-yellow-300' :
                        campaign.status === 'Finalizada' ? 'bg-gray-100 text-gray-700 dark:bg-gray-700/30 dark:text-gray-300' :
                        'bg-red-100 text-red-700 dark:bg-red-700/30 dark:text-red-300' 
                      }`}>
                        {campaign.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="outline" size="icon" onClick={() => handleViewDetails(campaign)} title="Ver Detalles" className="border-theme-celestial text-theme-celestial hover:bg-theme-celestial/10">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => openForm('edit', campaign)} title="Editar Campaña" className="border-theme-celestial text-theme-celestial hover:bg-theme-celestial/10">
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      {campaign.status !== 'Archivada' && (
                        <Button variant="outline" size="icon" onClick={() => handleArchiveCampaign(campaign.id)} title="Archivar Campaña" className="border-theme-davy text-theme-davy hover:bg-theme-davy/10" disabled={isLoading}>
                          <Archive className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-theme-davy dark:text-theme-powder/70">No se encontraron campañas.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={(isOpen) => { setIsFormOpen(isOpen); if (!isOpen) setCurrentCampaign(initialCampaignForm); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-theme-midnight dark:text-theme-powder text-xl">
              {formMode === 'new' ? 'Nueva Campaña Publicitaria' : `Editar Campaña: ${currentCampaign.name}`}
            </DialogTitle>
            <DialogDescription>
              {formMode === 'new' ? 'Completa los detalles de la nueva campaña.' : 'Actualiza la información de la campaña.'}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(90vh-200px)] pr-5">
            <div className="grid gap-4 py-4 ">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label htmlFor="campaignName">Nombre Campaña</Label><Input id="campaignName" value={currentCampaign.name} onChange={(e) => handleInputChange('name', e.target.value)} placeholder="Ej: Promoción Verano"/></div>
                <div>
                  <Label htmlFor="campaignPlatform">Plataforma</Label>
                  <Select value={currentCampaign.platform} onValueChange={(value) => handleInputChange('platform', value)}>
                    <SelectTrigger id="campaignPlatform"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {campaignPlatforms.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label htmlFor="start_date">Fecha de Inicio</Label><DatePicker date={currentCampaign.start_date} setDate={(date) => handleDateChange('start_date', date)} buttonClassName="w-full" /></div>
                <div><Label htmlFor="end_date">Fecha de Fin (opcional)</Label><DatePicker date={currentCampaign.end_date} setDate={(date) => handleDateChange('end_date', date)} buttonClassName="w-full" /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label htmlFor="campaignBudget">Presupuesto Total ($)</Label><Input id="campaignBudget" type="number" value={currentCampaign.budget} onChange={(e) => handleInputChange('budget', e.target.value)} placeholder="Ej: 500.00"/></div>
                <div>
                  <Label htmlFor="campaignStatus">Estado</Label>
                  <Select value={currentCampaign.status} onValueChange={(value) => handleInputChange('status', value)}>
                    <SelectTrigger id="campaignStatus"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {campaignStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label htmlFor="campaignObjectives">Objetivos</Label><Textarea id="campaignObjectives" value={currentCampaign.objectives} onChange={(e) => handleInputChange('objectives', e.target.value)} placeholder="Ej: Aumentar leads, Mejorar reconocimiento de marca"/></div>
              <div><Label htmlFor="campaignNotes">Notas Adicionales</Label><Textarea id="campaignNotes" value={currentCampaign.notes} onChange={(e) => handleInputChange('notes', e.target.value)} placeholder="Detalles, audiencias, etc."/></div>
            </div>
          </ScrollArea>
          <DialogFooter className="pt-4">
            <DialogClose asChild><Button variant="outline" disabled={isLoading}>Cancelar</Button></DialogClose>
            <Button onClick={handleSaveCampaign} className="bg-gradient-to-r from-theme-celestial to-theme-midnight hover:from-theme-celestial-dark hover:to-theme-midnight-dark text-white" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {formMode === 'new' ? 'Crear Campaña' : 'Guardar Cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-theme-midnight dark:text-theme-powder text-xl">Detalles de Campaña: {selectedCampaignDetails?.name}</DialogTitle>
            <DialogDescription>Información y métricas (simuladas) de la campaña.</DialogDescription>
          </DialogHeader>
          {selectedCampaignDetails && (
            <ScrollArea className="max-h-[60vh] pr-3">
              <div className="space-y-3 py-2">
                <p><strong>Plataforma:</strong> {selectedCampaignDetails.platform}</p>
                <p><strong>Fechas:</strong> {selectedCampaignDetails.start_date ? format(selectedCampaignDetails.start_date, 'dd/MM/yyyy') : 'N/A'} - {selectedCampaignDetails.end_date ? format(selectedCampaignDetails.end_date, 'dd/MM/yyyy') : 'N/A'}</p>
                <p><strong>Presupuesto:</strong> ${selectedCampaignDetails.budget?.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                <p><strong>Estado:</strong> {selectedCampaignDetails.status}</p>
                <p><strong>Objetivos:</strong> {selectedCampaignDetails.objectives || 'No especificados'}</p>
                <p><strong>Notas:</strong> {selectedCampaignDetails.notes || 'Ninguna'}</p>
                <Card className="mt-4 bg-slate-50 dark:bg-theme-davy-dark/30">
                  <CardHeader><CardTitle className="text-md">Métricas de Rendimiento (Simuladas)</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-2 gap-2 text-sm">
                    <p><strong>Impresiones:</strong> {selectedCampaignDetails.kpis.impressions.toLocaleString()}</p>
                    <p><strong>Clicks:</strong> {selectedCampaignDetails.kpis.clicks.toLocaleString()}</p>
                    <p><strong>Conversiones:</strong> {selectedCampaignDetails.kpis.conversions.toLocaleString()}</p>
                    <p><strong>CTR:</strong> {selectedCampaignDetails.kpis.ctr}</p>
                    <p><strong>CPC:</strong> {selectedCampaignDetails.kpis.cpc}</p>
                    <p><strong>CPA:</strong> {selectedCampaignDetails.kpis.cpa}</p>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          )}
          <DialogFooter className="pt-4">
            <Button onClick={() => setIsDetailsModalOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </motion.div>
  );
};

export default AdCampaigns;