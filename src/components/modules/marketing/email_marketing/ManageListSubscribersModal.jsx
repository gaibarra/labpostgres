import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from 'lucide-react';
import apiClient from '@/lib/apiClient';

const ManageListSubscribersModal = ({ list, allSubscribers, isOpen, onClose, onListUpdate }) => {
  const { toast } = useToast();
  const [selectedSubscriberIds, setSelectedSubscriberIds] = useState(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchListSubscribers = async () => {
      if (list) {
        setIsLoading(true);
        try {
          const data = await apiClient.get(`/marketing/email/lists`);
          // find list subscribers from aggregated endpoint (fallback: separate endpoint could be added)
          const { data: raw } = { data: [] }; // placeholder removed; we rely on dedicated endpoint soon
        } catch (e) {
          // fallback: ignore
        } finally { setIsLoading(false); }
      }
    };

    if (isOpen) {
      fetchListSubscribers();
    }
  }, [list, isOpen, toast]);

  const handleToggleSubscriber = (subscriberId) => {
    setSelectedSubscriberIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(subscriberId)) {
        newSet.delete(subscriberId);
      } else {
        newSet.add(subscriberId);
      }
      return newSet;
    });
  };

  const handleSave = async () => {
    if (!list) return;

    setIsLoading(true);
    try {
      await apiClient.post(`/marketing/email/lists/${list.id}/subscribers`, { subscriberIds: Array.from(selectedSubscriberIds) });
      toast({ title: 'Éxito', description: 'Lista de suscriptores actualizada.' });
      onListUpdate();
      onClose();
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudieron guardar los cambios.', variant: 'destructive' });
    } finally { setIsLoading(false); }
  };
  
  const filteredSubscribers = allSubscribers.filter(s =>
    s.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.first_name && s.first_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gestionar Suscriptores</DialogTitle>
          <DialogDescription>
            Añade o elimina suscriptores para la lista "{list?.name}".
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <Input 
            placeholder="Buscar por email o nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <ScrollArea className="h-64 border rounded-md p-4">
            {isLoading ? (
              <div className="flex justify-center items-center h-full">
                <Loader2 className="h-6 w-6 animate-spin"/>
              </div>
            ) : filteredSubscribers.length > 0 ? (
                filteredSubscribers.map(subscriber => (
                  <div key={subscriber.id} className="flex items-center space-x-2 mb-2">
                    <Checkbox
                      id={`sub-${subscriber.id}`}
                      checked={selectedSubscriberIds.has(subscriber.id)}
                      onCheckedChange={() => handleToggleSubscriber(subscriber.id)}
                    />
                    <Label htmlFor={`sub-${subscriber.id}`} className="flex flex-col">
                      <span>{subscriber.first_name || ''} {subscriber.last_name || ''}</span>
                      <span className="text-xs text-muted-foreground">{subscriber.email}</span>
                    </Label>
                  </div>
                ))
            ) : (
                <p className="text-sm text-center text-muted-foreground">No hay suscriptores para mostrar.</p>
            )}
          </ScrollArea>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : 'Guardar Cambios'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ManageListSubscribersModal;