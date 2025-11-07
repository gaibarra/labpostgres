import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Save } from 'lucide-react';

const TemplateFormDialog = ({
  isOpen,
  onOpenChange,
  formMode,
  currentTemplate,
  handleInputChange,
  templateTypes,
  currentPlaceholders,
  handleCheckboxChange,
  onSave,
  isLoading
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] md:max-w-[800px] lg:max-w-[1000px]">
        <DialogHeader>
          <DialogTitle>{formMode === 'new' ? 'Nueva Plantilla' : (formMode === 'clone' ? 'Clonar Plantilla' : 'Editar Plantilla')}</DialogTitle>
          <DialogDescription>
            {formMode === 'new' ? 'Crea una nueva plantilla para tus documentos.' : (formMode === 'clone' ? `Crear una copia de "${currentTemplate?.name || ''}".` : `Modifica la plantilla "${currentTemplate?.name || ''}".`)}
          </DialogDescription>
        </DialogHeader>
        {currentTemplate && (
          <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="templateName" className="text-right">Nombre</Label>
              <Input id="templateName" value={currentTemplate.name} onChange={(e) => handleInputChange('name', e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="templateType" className="text-right">Tipo</Label>
              <div className="col-span-3">
                <SearchableSelect
                  options={(templateTypes||[]).map(t=>({value:t.value,label:t.label}))}
                  value={currentTemplate.type}
                  onValueChange={(value) => handleInputChange('type', value)}
                  placeholder="Selecciona tipo..."
                  searchPlaceholder="Buscar tipo..."
                  notFoundMessage="Sin tipos"
                  disabled={formMode === 'edit' && currentTemplate.is_system}
                />
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="templateHeader" className="text-right">Encabezado</Label>
              <Textarea id="templateHeader" value={currentTemplate.header || ''} onChange={(e) => handleInputChange('header', e.target.value)} className="col-span-3 min-h-[80px]" placeholder="Contenido del encabezado..."/>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="templateContent" className="text-right">Contenido Principal</Label>
              <Textarea id="templateContent" value={currentTemplate.content} onChange={(e) => handleInputChange('content', e.target.value)} className="col-span-3 min-h-[200px]" placeholder="Cuerpo de la plantilla..."/>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="templateFooter" className="text-right">Pie de Página</Label>
              <Textarea id="templateFooter" value={currentTemplate.footer || ''} onChange={(e) => handleInputChange('footer', e.target.value)} className="col-span-3 min-h-[80px]" placeholder="Contenido del pie de página..."/>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right col-span-1">Marcadores Disponibles</Label>
              <ScrollArea className="col-span-3 h-24 rounded-md border p-2 text-xs bg-slate-50 dark:bg-slate-800">
                {(currentPlaceholders || []).length > 0 ? currentPlaceholders.join(', ') : 'No hay marcadores específicos para este tipo.'}
              </ScrollArea>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="isDefault" className="text-right">Predeterminada</Label>
              <div className="col-span-3 flex items-center">
                <Input 
                  type="checkbox" 
                  id="isDefault" 
                  checked={currentTemplate.is_default} 
                  onChange={(e) => handleCheckboxChange('is_default', e.target.checked)}
                  className="h-5 w-5 mr-2"
                  disabled={(formMode === 'edit' && currentTemplate.is_system && currentTemplate.is_default) || isLoading}
                />
                <span className="text-sm text-slate-600 dark:text-slate-400">Marcar como plantilla predeterminada para este tipo.</span>
              </div>
            </div>
            {currentTemplate.is_system && (
              <p className="col-span-4 text-xs text-center text-yellow-600 dark:text-yellow-400">Esta es una plantilla del sistema. Algunas propiedades no se pueden modificar.</p>
            )}
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
          <Button onClick={onSave} disabled={isLoading} className="bg-gradient-to-r from-sky-500 to-cyan-600 hover:from-sky-600 hover:to-cyan-700 text-white">
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Guardar Plantilla
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TemplateFormDialog;