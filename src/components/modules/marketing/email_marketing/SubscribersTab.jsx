import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { PlusCircle, Edit3, Trash2, Loader2 } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { format } from 'date-fns';
import apiClient from '@/lib/apiClient';

const SubscriberForm = ({ subscriber, onSave, onCancel, isLoading }) => {
  const [currentSubscriber, setCurrentSubscriber] = useState(
    subscriber || { email: '', first_name: '', last_name: '' }
  );

  useEffect(() => {
    setCurrentSubscriber(subscriber || { email: '', first_name: '', last_name: '' });
  }, [subscriber]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCurrentSubscriber(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(currentSubscriber);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
        <Input id="email" name="email" type="email" value={currentSubscriber.email} onChange={handleChange} required disabled={!!subscriber?.id} />
      </div>
      <div>
        <label htmlFor="first_name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre</label>
        <Input id="first_name" name="first_name" value={currentSubscriber.first_name || ''} onChange={handleChange} />
      </div>
      <div>
        <label htmlFor="last_name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Apellido</label>
        <Input id="last_name" name="last_name" value={currentSubscriber.last_name || ''} onChange={handleChange} />
      </div>
      <DialogFooter className="pt-4">
        <DialogClose asChild><Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button></DialogClose>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Guardar'}
        </Button>
      </DialogFooter>
    </form>
  );
};

const SubscribersTab = ({ subscribers, loadSubscribers, isLoading: isMainLoading }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentSubscriber, setCurrentSubscriber] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const openForm = (subscriber = null) => {
    setCurrentSubscriber(subscriber);
    setIsFormOpen(true);
  };

  const handleSave = async (subscriberData) => {
    setIsSaving(true);
    try {
      if (subscriberData.id) {
        await apiClient.put(`/marketing/email/subscribers/${subscriberData.id}`, { first_name: subscriberData.first_name, last_name: subscriberData.last_name });
      } else {
        await apiClient.post('/marketing/email/subscribers', subscriberData);
      }
      toast({ title: 'Éxito', description: `Suscriptor ${subscriberData.id ? 'actualizado' : 'creado'} correctamente.` });
      await loadSubscribers();
      setIsFormOpen(false);
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally { setIsSaving(false); }
  };
  
  const handleDelete = async (subscriberId) => {
    try {
      await apiClient.delete(`/marketing/email/subscribers/${subscriberId}`);
      toast({ title: 'Suscriptor Eliminado', variant: 'destructive' });
      await loadSubscribers();
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const filteredSubscribers = subscribers.filter(s =>
    s.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.first_name && s.first_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (s.last_name && s.last_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <Input
          placeholder="Buscar suscriptores..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm bg-white dark:bg-theme-davy-dark/50 border-theme-powder dark:border-theme-davy"
        />
        <Button
          onClick={() => openForm()}
          className="bg-gradient-to-r from-theme-celestial to-theme-midnight hover:from-theme-celestial-dark hover:to-theme-midnight-dark text-white"
        >
          <PlusCircle className="mr-2 h-4 w-4" /> Nuevo Suscriptor
        </Button>
      </div>
      <ScrollArea className="h-[400px] rounded-md border border-theme-powder dark:border-theme-davy">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Fecha de Alta</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isMainLoading ? (
                 <TableRow><TableCell colSpan={4} className="text-center h-24"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
            ) : filteredSubscribers.length > 0 ? filteredSubscribers.map(s => (
              <TableRow key={s.id}>
                <TableCell>{s.email}</TableCell>
                <TableCell>{s.first_name || ''} {s.last_name || ''}</TableCell>
                <TableCell>{format(new Date(s.created_at), 'dd/MM/yyyy')}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="outline" size="icon" onClick={() => openForm(s)}>
                    <Edit3 className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(s.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={4} className="text-center h-24">No se encontraron suscriptores.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ScrollArea>
      
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentSubscriber?.id ? 'Editar Suscriptor' : 'Nuevo Suscriptor'}</DialogTitle>
          </DialogHeader>
          <SubscriberForm
            subscriber={currentSubscriber}
            onSave={handleSave}
            onCancel={() => setIsFormOpen(false)}
            isLoading={isSaving}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SubscribersTab;