import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from '@/components/ui/scroll-area';
import { DatePicker } from '@/components/ui/datepicker'; 
import { format, setHours, setMinutes, setSeconds, parseISO } from 'date-fns';

const campaignStatuses = ['Borrador', 'Programada', 'Enviando', 'Enviada', 'Archivada', 'Error'];

const CampaignFormDialog = ({ isOpen, onOpenChange, onSave, mode, initialData, lists, templates }) => {
  const [currentCampaign, setCurrentCampaign] = useState(initialData);
  const [campaignSendTime, setCampaignSendTime] = useState('09:00');
  
  useEffect(() => {
    if (isOpen) {
      const campDate = initialData.sendDateTime ? (typeof initialData.sendDateTime === 'string' ? parseISO(initialData.sendDateTime) : initialData.sendDateTime) : null;
      setCurrentCampaign({ ...initialData, sendDateTime: campDate });
      setCampaignSendTime(campDate ? format(campDate, 'HH:mm') : '09:00');
    }
  }, [initialData, isOpen]);

  const handleSave = () => {
    if (!currentCampaign.name || !currentCampaign.subject || !currentCampaign.listId || !currentCampaign.templateId || !currentCampaign.sendDateTime) {
      // You can add a toast notification here for better UX
      console.error("Todos los campos son obligatorios para la campaña.");
      return;
    }
    const [hours, minutes] = campaignSendTime.split(':').map(Number);
    const finalSendDateTime = setSeconds(setMinutes(setHours(currentCampaign.sendDateTime, hours), minutes), 0);
    
    onSave(currentCampaign, finalSendDateTime);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{mode === 'new' ? 'Nueva Campaña de Email' : 'Editar Campaña'}</DialogTitle>
          <DialogDescription className="sr-only">
            Formulario para {mode === 'new' ? 'crear una nueva' : 'editar una'} campaña de email incluyendo nombre, asunto, lista, plantilla, fecha y hora de envío y estado.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-200px)] pr-5">
          <div className="grid gap-4 py-4">
            <div><Label htmlFor="campName">Nombre Campaña</Label><Input id="campName" value={currentCampaign.name} onChange={(e) => setCurrentCampaign({...currentCampaign, name: e.target.value})} /></div>
            <div><Label htmlFor="campSubject">Asunto</Label><Input id="campSubject" value={currentCampaign.subject} onChange={(e) => setCurrentCampaign({...currentCampaign, subject: e.target.value})} /></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="campList">Lista de Suscriptores</Label>
                <Select value={currentCampaign.listId} onValueChange={(val) => setCurrentCampaign({...currentCampaign, listId: val})}>
                  <SelectTrigger id="campList"><SelectValue placeholder="Seleccionar lista..."/></SelectTrigger>
                  <SelectContent>{lists.map(l => <SelectItem key={l.id} value={l.id}>{l.name} ({l.subscriberCount} suscriptores)</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="campTemplate">Plantilla de Email</Label>
                <Select value={currentCampaign.templateId} onValueChange={(val) => setCurrentCampaign({...currentCampaign, templateId: val})}>
                  <SelectTrigger id="campTemplate"><SelectValue placeholder="Seleccionar plantilla..."/></SelectTrigger>
                  <SelectContent>{templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name} - {t.subject}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label htmlFor="campSendDate">Fecha de Envío</Label><DatePicker date={currentCampaign.sendDateTime} setDate={(date) => setCurrentCampaign({...currentCampaign, sendDateTime: date})} buttonClassName="w-full"/></div>
              <div><Label htmlFor="campSendTime">Hora de Envío</Label><Input id="campSendTime" type="time" value={campaignSendTime} onChange={(e) => setCampaignSendTime(e.target.value)} /></div>
            </div>
            <div>
              <Label htmlFor="campStatus">Estado</Label>
              <Select value={currentCampaign.status} onValueChange={(val) => setCurrentCampaign({...currentCampaign, status: val})}>
                <SelectTrigger id="campStatus"><SelectValue/></SelectTrigger>
                <SelectContent>{campaignStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </ScrollArea>
        <DialogFooter><DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose><Button onClick={handleSave}>Guardar Campaña</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CampaignFormDialog;