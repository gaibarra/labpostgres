import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

// Solo dos tipos permitidos ahora: Médico | Institución
const referrerTypes = ["Médico", "Institución"];

function isDoctorType(value){
  if(!value) return false;
  const v = value.toLowerCase();
  return v.startsWith('médic') || v.startsWith('medic');
}

const ReferrerForm = ({ currentReferrer, handleInputChange, handleSelectChange, handleSubmit, closeForm, isSubmitting }) => {
  const isParticular = currentReferrer.name === 'Particular';

  return (
    <form onSubmit={handleSubmit}>
      <ScrollArea className="h-[60vh] p-1">
        <div className="space-y-4 pr-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Nombre <span className="text-red-500">*</span></Label>
              <Input 
                id="name" 
                name="name" 
                value={currentReferrer.name} 
                onChange={handleInputChange} 
                placeholder="Nombre completo o Institución" 
                required 
                disabled={isParticular || isSubmitting}
              />
            </div>
            <div>
              <Label htmlFor="entity_type">Tipo <span className="text-red-500">*</span></Label>
              <Select 
                name="entity_type" 
                value={currentReferrer.entity_type} 
                onValueChange={(value) => handleSelectChange('entity_type', value)}
                disabled={isParticular || isSubmitting}
                required
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {isParticular ? (
                    <SelectItem value="Particular">Particular</SelectItem>
                  ) : (
                    referrerTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          {isDoctorType(currentReferrer.entity_type) && (
            <div>
              <Label htmlFor="specialty">Especialidad</Label>
              <Input id="specialty" name="specialty" value={currentReferrer.specialty || ''} onChange={handleInputChange} placeholder="Ej: Cardiología" disabled={isSubmitting} />
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="phone_number">Teléfono</Label>
              <Input id="phone_number" name="phone_number" type="tel" value={currentReferrer.phone_number || ''} onChange={handleInputChange} placeholder="Ej: 5512345678" disabled={isSubmitting} />
            </div>
            <div>
              <Label htmlFor="email">Email <span className="text-xs text-slate-400 dark:text-slate-500 font-normal">(opcional)</span></Label>
              <Input id="email" name="email" type="email" value={currentReferrer.email || ''} onChange={handleInputChange} placeholder="correo@ejemplo.com (opcional)" disabled={isSubmitting} />
            </div>
          </div>
           <div>
              <Label htmlFor="address">Dirección</Label>
              <Input id="address" name="address" value={currentReferrer.address || ''} onChange={handleInputChange} placeholder="Calle, Número, Colonia, Ciudad" disabled={isSubmitting} />
            </div>
        </div>
      </ScrollArea>
      <DialogFooter className="pt-4 mt-4 border-t flex flex-col sm:flex-row gap-2">
        <DialogClose asChild><Button type="button" variant="outline" onClick={closeForm} disabled={isSubmitting}>Cancelar</Button></DialogClose>
        <Button type="submit" className="bg-gradient-to-r from-sky-500 to-cyan-500 text-white" disabled={isSubmitting || isParticular}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {currentReferrer.id ? 'Guardar Cambios' : 'Registrar'}
        </Button>
      </DialogFooter>
    </form>
  );
};

export default ReferrerForm;