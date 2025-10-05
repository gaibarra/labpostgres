import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/lib/apiClient';
import { motion } from 'framer-motion';
import { useToast } from "@/components/ui/use-toast";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { PlusCircle, Edit, Trash2, Search, Loader2, BarChart2 } from 'lucide-react';
import { useDebounce } from 'use-debounce';
// Import de date-fns removido para date_of_birth porque provocar parse a Date genera desplazamientos
// en zonas horarias negativas (ej: América) al interpretar 'YYYY-MM-DD' como UTC midnight.
// Mantener fechas de nacimiento como cadenas evita el bug 1965-01-03 -> 1965-01-02.
import { format } from 'date-fns'; // queda para otros usos potenciales, no usar en DOB

const PatientForm = ({ patient, onSave, onCancel, isLoading }) => {
  const initialPatientState = {
    full_name: '',
    date_of_birth: '',
    sex: '',
    email: '',
    phone_number: '',
    address: '',
    contact_name: '',
    contact_phone: '',
    clinical_history: ''
  };

  const [currentPatient, setCurrentPatient] = useState(initialPatientState);

  useEffect(() => {
    if (patient) {
      // NO parsear a Date para evitar cambios de día por offset. Usar la cadena tal cual.
      setCurrentPatient({
        ...initialPatientState,
        ...patient,
        date_of_birth: patient.date_of_birth || '',
      });
    } else {
      setCurrentPatient(initialPatientState);
    }
  }, [patient]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCurrentPatient(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const dataToSave = { ...currentPatient };
    if (!dataToSave.email) delete dataToSave.email;
    if (!dataToSave.phone_number) delete dataToSave.phone_number;
    if (!dataToSave.address) delete dataToSave.address;
    if (!dataToSave.contact_name) delete dataToSave.contact_name;
    if (!dataToSave.contact_phone) delete dataToSave.contact_phone;
    if (!dataToSave.clinical_history) delete dataToSave.clinical_history;
    
    onSave(dataToSave);
  };

  return (
    <form onSubmit={handleSubmit}>
      <ScrollArea className="h-[60vh] p-1">
        <div className="space-y-4 pr-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="full_name">Nombre Completo</Label>
              <Input id="full_name" name="full_name" value={currentPatient.full_name} onChange={handleChange} required />
            </div>
            <div>
              <Label htmlFor="date_of_birth">Fecha de Nacimiento</Label>
              <Input id="date_of_birth" name="date_of_birth" type="date" value={currentPatient.date_of_birth} onChange={handleChange} required />
            </div>
            <div>
              <Label htmlFor="sex">Sexo</Label>
              <select id="sex" name="sex" value={currentPatient.sex} onChange={handleChange} required className="w-full p-2 border rounded-md bg-transparent">
                <option value="">Seleccione...</option>
                <option value="Masculino">Masculino</option>
                <option value="Femenino">Femenino</option>
              </select>
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" value={currentPatient.email || ''} onChange={handleChange} />
            </div>
            <div>
              <Label htmlFor="phone_number">Teléfono</Label>
              <Input id="phone_number" name="phone_number" value={currentPatient.phone_number || ''} onChange={handleChange} />
            </div>
            <div>
              <Label htmlFor="address">Dirección</Label>
              <Input id="address" name="address" value={currentPatient.address || ''} onChange={handleChange} />
            </div>
            <div>
              <Label htmlFor="contact_name">Nombre de Contacto</Label>
              <Input id="contact_name" name="contact_name" value={currentPatient.contact_name || ''} onChange={handleChange} />
            </div>
            <div>
              <Label htmlFor="contact_phone">Teléfono de Contacto</Label>
              <Input id="contact_phone" name="contact_phone" value={currentPatient.contact_phone || ''} onChange={handleChange} />
            </div>
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="clinical_history">Historial Clínico (resumen)</Label>
            <Textarea id="clinical_history" name="clinical_history" value={currentPatient.clinical_history || ''} onChange={handleChange} rows={4} />
          </div>
        </div>
      </ScrollArea>
      <DialogFooter className="pt-4 mt-4 border-t">
        <DialogClose asChild><Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button></DialogClose>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Guardar'}
        </Button>
      </DialogFooter>
    </form>
  );
};


const Patients = () => {
  const [patients, setPatients] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm] = useDebounce(searchTerm, 300);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentPatient, setCurrentPatient] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchPatients = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearchTerm) params.append('q', debouncedSearchTerm);
      const data = await apiClient.get(`/patients?${params.toString()}`);
      setPatients(Array.isArray(data) ? data : []);
    } catch (err) {
      toast({ title: 'Error', description: 'No se pudieron cargar los pacientes.', variant: 'destructive' });
    } finally { setIsLoading(false); }
  }, [debouncedSearchTerm, toast]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  const openForm = (patient = null) => {
    setCurrentPatient(patient);
    setIsFormOpen(true);
  };
  
  const handleViewHistory = (patientId) => {
    navigate(`/patients/${patientId}/history`);
  };

  const handleSave = async (patientData) => {
    setIsSaving(true);
    let error;
    const { id, ...dataToUpsert } = patientData;

    try {
      if (id) {
        await apiClient.put(`/patients/${id}`, dataToUpsert);
      } else {
        await apiClient.post('/patients', dataToUpsert);
      }
      toast({ title: 'Éxito', description: `Paciente ${id ? 'actualizado' : 'creado'} correctamente.` });
      await fetchPatients();
      setIsFormOpen(false);
      setCurrentPatient(null);
    } catch (err) {
      toast({ title: 'Error', description: err.message || 'Fallo al guardar', variant: 'destructive' });
    }
    setIsSaving(false);
  };

  const handleDelete = async (patientId) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este paciente? Esta acción no se puede deshacer.')) return;

    try {
      await apiClient.delete(`/patients/${patientId}`);
      toast({ title: 'Paciente Eliminado', variant: 'destructive' });
      await fetchPatients();
    } catch (err) {
      toast({ title: 'Error', description: err.message || 'No se pudo eliminar', variant: 'destructive' });
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <Card className="shadow-lg">
        <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between">
          <div>
            <CardTitle className="text-2xl">Gestión de Pacientes</CardTitle>
            <CardDescription>Añade, edita y gestiona la información de tus pacientes.</CardDescription>
          </div>
          <Button onClick={() => openForm()} className="mt-4 md:mt-0">
            <PlusCircle className="mr-2 h-4 w-4" /> Nuevo Paciente
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                placeholder="Buscar por nombre, email o teléfono..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <ScrollArea className="w-full whitespace-nowrap h-[calc(100vh-320px)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="hidden sm:table-cell">Email</TableHead>
                  <TableHead className="hidden md:table-cell">Móvil</TableHead>
                  <TableHead>Sexo</TableHead>
                  <TableHead className="hidden lg:table-cell">Fecha Nac.</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : patients.length > 0 ? (
                  patients.map(p => (
                    <TableRow key={p.id}>
                      <TableCell>{p.full_name}</TableCell>
                      <TableCell className="hidden sm:table-cell">{p.email}</TableCell>
                      <TableCell className="hidden md:table-cell">{p.phone_number}</TableCell>
                      <TableCell>{p.sex}</TableCell>
                      <TableCell className="hidden lg:table-cell">{
                        (() => {
                          const dob = p.date_of_birth;
                          if (!dob) return 'N/A';
                          if (/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
                            const [y, m, d] = dob.split('-');
                            const MONTH_ABBR = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
                            const idx = parseInt(m, 10) - 1;
                            const month = MONTH_ABBR[idx] || m;
                            return `${d} ${month} ${y}`;
                          }
                          return dob;
                        })()
                      }</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="outline" size="icon" onClick={() => handleViewHistory(p.id)}>
                          <BarChart2 className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" onClick={() => openForm(p)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="destructive" size="icon" onClick={() => handleDelete(p.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24">No se encontraron pacientes.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{currentPatient?.id ? 'Editar Paciente' : 'Nuevo Paciente'}</DialogTitle>
          </DialogHeader>
          <PatientForm
            patient={currentPatient}
            onSave={handleSave}
            onCancel={() => {
              setIsFormOpen(false);
              setCurrentPatient(null);
            }}
            isLoading={isSaving}
          />
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default Patients;