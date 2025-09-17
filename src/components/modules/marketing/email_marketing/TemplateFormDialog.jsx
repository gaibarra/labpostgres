import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Wand2 } from 'lucide-react';
import AIAssistEmailDialog from './AIAssistEmailDialog';

const TemplateFormDialog = ({ isOpen, onOpenChange, onSave, mode, initialData }) => {
  const [currentTemplate, setCurrentTemplate] = useState(initialData);
  const [isAIAssistOpen, setIsAIAssistOpen] = useState(false);

  useEffect(() => {
    setCurrentTemplate(initialData);
  }, [initialData, isOpen]);

  const handleSave = () => {
    onSave(currentTemplate);
  };
  
  const handleAIContentGenerated = ({ subject, body }) => {
    setCurrentTemplate(prev => ({
      ...prev,
      subject,
      body
    }));
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{mode === 'new' ? 'Nueva Plantilla de Email' : 'Editar Plantilla'}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(90vh-200px)] pr-5">
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="templateName">Nombre Plantilla</Label>
                <Input id="templateName" value={currentTemplate.name} onChange={(e) => setCurrentTemplate({ ...currentTemplate, name: e.target.value })} />
              </div>
              <div className="relative">
                <Label htmlFor="templateSubject">Asunto</Label>
                <Input id="templateSubject" value={currentTemplate.subject} onChange={(e) => setCurrentTemplate({ ...currentTemplate, subject: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="templateBody">Cuerpo del Email (usa `{"{{nombre_suscriptor}}"})`</Label>
                <Textarea id="templateBody" value={currentTemplate.body} onChange={(e) => setCurrentTemplate({ ...currentTemplate, body: e.target.value })} rows={10} />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="flex justify-between w-full">
            <Button variant="outline" onClick={() => setIsAIAssistOpen(true)} className="mr-auto">
              <Wand2 className="mr-2 h-4 w-4 text-purple-500" />
              Asistente IA
            </Button>
            <div>
              <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
              <Button onClick={handleSave} className="ml-2">Guardar Plantilla</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AIAssistEmailDialog
        open={isAIAssistOpen}
        onOpenChange={setIsAIAssistOpen}
        onContentGenerated={handleAIContentGenerated}
      />
    </>
  );
};

export default TemplateFormDialog;