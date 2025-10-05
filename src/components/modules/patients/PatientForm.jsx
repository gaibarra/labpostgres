import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Loader2, FilePlus2, Save } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { format, parseISO, isValid } from 'date-fns';

const PatientForm = ({ patient, onSave, onCancel, isLoading }) => {
  const { toast } = useToast();
  const initialPatientState = {
    full_name: '', date_of_birth: '', sex: '', email: '',
    phone_number: '', address: '', contact_name: '',
    contact_phone: '', clinical_history: ''
  };

  const [currentPatient, setCurrentPatient] = useState(initialPatientState);

  useEffect(() => {
    if (patient) {
      const birthDate = patient.date_of_birth ? parseISO(patient.date_of_birth) : null;
      // Mapear códigos back-end a etiquetas legibles
      let sexLabel = patient.sex;
      if (patient.sex === 'M') sexLabel = 'Masculino';
      else if (patient.sex === 'F') sexLabel = 'Femenino';
  // sin opción 'Otro'
      setCurrentPatient({
        ...initialPatientState,
        ...patient,
        sex: sexLabel || '',
        date_of_birth: birthDate && isValid(birthDate) ? format(birthDate, 'yyyy-MM-dd') : '',
      });
    } else {
      setCurrentPatient(initialPatientState);
    }
  }, [patient]);

  const formatName = (name) => {
    if (!name) return '';
    return name.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'full_name' || name === 'contact_name') {
      setCurrentPatient(prev => ({ ...prev, [name]: formatName(value) }));
    } else {
      setCurrentPatient(prev => ({ ...prev, [name]: value }));
    }
  };

  const validateForm = () => {
    if (!currentPatient.full_name || !currentPatient.date_of_birth || !currentPatient.sex || !currentPatient.email) {
      toast({
        title: "Campos obligatorios",
        description: "Por favor, complete Nombre, Fecha de Nacimiento, Sexo y Email.",
        variant: "destructive",
      });
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(currentPatient.email)) {
      toast({
        title: "Email inválido",
        description: "Por favor, ingrese una dirección de correo electrónico válida.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const getDataToSave = () => {
    const dataToSave = { ...currentPatient };
    // Normalizar sex de etiqueta a código backend
    if (dataToSave.sex) {
      if (dataToSave.sex === 'Masculino') dataToSave.sex = 'M';
      else if (dataToSave.sex === 'Femenino') dataToSave.sex = 'F';
  // no se convierte 'Otro'
    }
    Object.keys(dataToSave).forEach(key => {
      if (dataToSave[key] === '') {
        delete dataToSave[key];
      }
    });
    return dataToSave;
  };

  const handleSaveSubmit = (e, andNewOrder = false) => {
    e.preventDefault();
    if (validateForm()) {
      onSave(getDataToSave(), andNewOrder);
    }
  };

  return (
    <form>
      <ScrollArea className="h-[60vh] py-1">
        <div className="pl-3 pr-3 md:pl-4 md:pr-4">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="full_name">Nombre Completo <span className="text-red-500">*</span></Label>
                <Input id="full_name" name="full_name" value={currentPatient.full_name} onChange={handleChange} required disabled={isLoading} className="dark:border-slate-600"/>
              </div>
              <div>
                <Label htmlFor="date_of_birth">Fecha de Nacimiento <span className="text-red-500">*</span></Label>
                <Input id="date_of_birth" name="date_of_birth" type="date" value={currentPatient.date_of_birth} onChange={handleChange} required disabled={isLoading} className="dark:border-slate-600"/>
              </div>
              <div>
                <Label htmlFor="sex">Sexo <span className="text-red-500">*</span></Label>
                <select id="sex" name="sex" value={currentPatient.sex} onChange={handleChange} required disabled={isLoading} className="w-full p-2 border rounded-md bg-transparent dark:bg-slate-800 dark:border-slate-600">
                  <option value="">Seleccione...</option>
                  <option value="Masculino">Masculino</option>
                  <option value="Femenino">Femenino</option>
                  {/* Se elimina opción 'Otro' */}
                </select>
              </div>
              <div>
                <Label htmlFor="email">Email <span className="text-red-500">*</span></Label>
                <Input id="email" name="email" type="email" value={currentPatient.email || ''} onChange={handleChange} required disabled={isLoading} className="dark:border-slate-600"/>
              </div>
              <div>
                <Label htmlFor="phone_number">Teléfono</Label>
                <Input id="phone_number" name="phone_number" value={currentPatient.phone_number || ''} onChange={handleChange} disabled={isLoading} className="dark:border-slate-600"/>
              </div>
              <div>
                <Label htmlFor="address">Dirección</Label>
                <Input id="address" name="address" value={currentPatient.address || ''} onChange={handleChange} disabled={isLoading} className="dark:border-slate-600"/>
              </div>
              <div>
                <Label htmlFor="contact_name">Nombre de Contacto</Label>
                <Input id="contact_name" name="contact_name" value={currentPatient.contact_name || ''} onChange={handleChange} disabled={isLoading} className="dark:border-slate-600"/>
              </div>
              <div>
                <Label htmlFor="contact_phone">Teléfono de Contacto</Label>
                <Input id="contact_phone" name="contact_phone" value={currentPatient.contact_phone || ''} onChange={handleChange} disabled={isLoading} className="dark:border-slate-600"/>
              </div>
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="clinical_history">Historial Clínico (resumen)</Label>
              <Textarea id="clinical_history" name="clinical_history" value={currentPatient.clinical_history || ''} onChange={handleChange} rows={4} disabled={isLoading} className="dark:border-slate-600"/>
            </div>
          </div>
        </div>
      </ScrollArea>
      <DialogFooter className="pt-4 mt-4 border-t flex flex-col sm:flex-row gap-2">
        <DialogClose asChild><Button type="button" variant="outline" onClick={onCancel} disabled={isLoading} className="w-full sm:w-auto">Cancelar</Button></DialogClose>
        <Button type="button" onClick={(e) => handleSaveSubmit(e, false)} disabled={isLoading} className="w-full sm:w-auto">
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Guardar
        </Button>
        <Button type="button" onClick={(e) => handleSaveSubmit(e, true)} disabled={isLoading} className="w-full sm:w-auto">
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <><FilePlus2 className="mr-2 h-4 w-4" /> Guardar y Registrar Orden</>}
        </Button>
      </DialogFooter>
    </form>
  );
};

export default PatientForm;