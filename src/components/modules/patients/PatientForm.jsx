import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Loader2, FilePlus2, Save, Mail, Phone, MessageCircle, Send } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { format, parseISO, isValid } from 'date-fns';

const initialPatientState = {
  full_name: '', date_of_birth: '', sex: '', email: '',
  phone_number: '', address: '', contact_name: '',
  contact_phone: '', clinical_history: ''
};

const PatientForm = ({ patient, onSave, onCancel, isLoading }) => {
  const { toast } = useToast();

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

  // --- Acciones de comunicación ---
  const sanitizePhoneForWhatsApp = (raw) => {
    if (!raw) return '';
    const trimmed = String(raw).trim();
    // Dejar + y dígitos
    const keep = trimmed.replace(/[^+\d]/g, '');
    // Si hay múltiples +, deja solo el primero
    return keep.replace(/\+(?=.*\+)/g, '');
  };
  const buildWhatsAppUrl = (phone, name) => {
    const ph = sanitizePhoneForWhatsApp(phone);
    if (!ph) return null;
    const greeting = `Hola ${name || ''}, te contactamos del laboratorio.`.trim();
    const text = encodeURIComponent(greeting);
    return `https://wa.me/${ph.replace(/^\+/, '')}?text=${text}`;
  };
  const handleSendWhatsApp = (phone, name) => {
    const url = buildWhatsAppUrl(phone, name);
    if (!url) {
      toast({ title: 'Número inválido', description: 'Captura un teléfono móvil válido (con lada país, ej. +52 …).', variant: 'destructive' });
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };
  const buildMailTo = (email, name) => {
    if (!email) return null;
    const subject = encodeURIComponent('Comunicación del Laboratorio');
    const body = encodeURIComponent(`Hola ${name || ''},\n\nTe contactamos del laboratorio.\n\nSaludos.`);
    return `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`;
  };
  const handleSendEmail = (email, name) => {
    const link = buildMailTo(email, name);
    if (!link) {
      toast({ title: 'Email faltante', description: 'Captura un correo electrónico para poder enviar.', variant: 'destructive' });
      return;
    }
    window.location.href = link;
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
                <Label htmlFor="email">Email (comunicación) <span className="text-red-500">*</span></Label>
                <div className="flex gap-2 items-center">
                  <Input id="email" name="email" type="email" placeholder="ej. paciente@correo.com" value={currentPatient.email || ''} onChange={handleChange} required disabled={isLoading} className="dark:border-slate-600"/>
                  <button type="button" onClick={() => handleSendEmail(currentPatient.email, currentPatient.full_name)} className="px-3 py-2 text-sm rounded-md bg-sky-600 hover:bg-sky-700 text-white disabled:opacity-50" disabled={!currentPatient.email} title="Enviar Email">
                    <span className="inline-flex items-center gap-1"><Send className="h-4 w-4" /> Email</span>
                  </button>
                </div>
                <p className="mt-1 text-xs text-slate-500 flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" /> Usaremos este correo para enviar avisos y resultados.
                </p>
              </div>
              <div>
                <Label htmlFor="phone_number">Teléfono móvil (WhatsApp)</Label>
                <div className="flex gap-2 items-center">
                  <Input id="phone_number" name="phone_number" type="tel" placeholder="ej. +52 55 1234 5678" value={currentPatient.phone_number || ''} onChange={handleChange} disabled={isLoading} className="dark:border-slate-600"/>
                  <button type="button" onClick={() => handleSendWhatsApp(currentPatient.phone_number, currentPatient.full_name)} className="px-3 py-2 text-sm rounded-md bg-green-600 hover:bg-green-700 text-white disabled:opacity-50" disabled={!currentPatient.phone_number} title="Enviar WhatsApp">
                    <span className="inline-flex items-center gap-1"><MessageCircle className="h-4 w-4" /> WhatsApp</span>
                  </button>
                </div>
                <p className="mt-1 text-xs text-slate-500 flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" /> Debe ser un número móvil. <MessageCircle className="h-3.5 w-3.5" /> Recibirá comunicaciones por WhatsApp.
                </p>
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
                <Label htmlFor="contact_phone">Teléfono móvil de Contacto (WhatsApp)</Label>
                <div className="flex gap-2 items-center">
                  <Input id="contact_phone" name="contact_phone" type="tel" placeholder="ej. +52 81 1234 5678" value={currentPatient.contact_phone || ''} onChange={handleChange} disabled={isLoading} className="dark:border-slate-600"/>
                  <button type="button" onClick={() => handleSendWhatsApp(currentPatient.contact_phone, currentPatient.contact_name || currentPatient.full_name)} className="px-3 py-2 text-sm rounded-md bg-green-600 hover:bg-green-700 text-white disabled:opacity-50" disabled={!currentPatient.contact_phone} title="Enviar WhatsApp a contacto">
                    <span className="inline-flex items-center gap-1"><MessageCircle className="h-4 w-4" /> WhatsApp</span>
                  </button>
                </div>
                <p className="mt-1 text-xs text-slate-500 flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" /> Debe ser un número móvil del contacto. <MessageCircle className="h-3.5 w-3.5" /> También se usará WhatsApp cuando sea necesario.
                </p>
              </div>
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="clinical_history">Historial Clínico (resumen)</Label>
              <Textarea id="clinical_history" name="clinical_history" value={currentPatient.clinical_history || ''} onChange={handleChange} rows={4} disabled={isLoading} className="dark:border-slate-600"/>
              <p className="mt-1 text-xs text-slate-500">
                Nota: La comunicación principal será por correo electrónico y WhatsApp a los números móviles capturados.
              </p>
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