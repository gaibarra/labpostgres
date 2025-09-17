import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from "@/components/ui/use-toast";
import { DollarSign, Tag, Loader2, Search } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

const StudyPriceAssignmentModal = ({ 
  isOpen, 
  onOpenChange, 
  study, 
  referrers, 
  onUpdatePrices,
  isSubmitting: isParentSubmitting
}) => {
  const { toast } = useToast();
  const [prices, setPrices] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (study && referrers) {
      const initialPrices = {};
      referrers.forEach(referrer => {
        const priceList = referrer.listaprecios?.studies || [];
        const studyPrice = priceList.find(p => p.itemId === study.id);
        initialPrices[referrer.id] = studyPrice ? studyPrice.price : '';
      });
      setPrices(initialPrices);
    }
    if (!isOpen) {
        setSearchTerm('');
    }
  }, [study, referrers, isOpen]);

  const handlePriceChange = (referrerId, value) => {
    setPrices(prev => ({ ...prev, [referrerId]: value }));
  };

  const handleSavePrice = async (referrerId) => {
    setIsSubmitting(true);
    const newPrice = prices[referrerId];
    if (newPrice === '' || isNaN(parseFloat(newPrice))) {
      toast({ title: "Precio inválido", description: "Por favor, introduce un número válido o deja el campo vacío para no asignar precio.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    const success = await onUpdatePrices(study.id, referrerId, newPrice);
    if(success) {
      const referrerName = referrers.find(r => r.id === referrerId)?.name;
      toast({ title: "Precio actualizado", description: `Precio para ${referrerName} guardado.` });
    }
    setIsSubmitting(false);
  };
  
  const handleRemovePrice = async (referrerId) => {
    setIsSubmitting(true);
    const success = await onUpdatePrices(study.id, referrerId, null);
    if(success) {
        handlePriceChange(referrerId, ''); 
        const referrerName = referrers.find(r => r.id === referrerId)?.name;
        toast({ title: "Precio eliminado", description: `Precio para ${referrerName} eliminado.` });
    }
    setIsSubmitting(false);
  };

  if (!study) return null;

  const validReferrers = Array.isArray(referrers) ? referrers : [];
  const filteredReferrers = validReferrers
    .filter(r => r.name !== 'Particular')
    .filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const isActionDisabled = isParentSubmitting || isSubmitting;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-slate-50 dark:bg-slate-900">
        <DialogHeader>
          <DialogTitle className="text-sky-700 dark:text-sky-400 flex items-center">
            <Tag className="h-6 w-6 mr-2 text-sky-500" />
            Asignar Precios para Estudio
          </DialogTitle>
          <DialogDescription>
            Establece precios específicos para "{study.name}" para cada referente.
          </DialogDescription>
        </DialogHeader>

        <div className="my-4 relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar referente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 bg-white/80 dark:bg-slate-800/80"
            />
        </div>

        <ScrollArea className="h-[40vh] pr-4">
          <div className="space-y-4">
            {filteredReferrers.length > 0 ? (
              filteredReferrers.map(referrer => (
                <div key={referrer.id} className="flex items-center justify-between">
                  <span className="font-medium text-slate-700 dark:text-slate-300">{referrer.name}</span>
                  <div className="flex items-center space-x-2">
                    <div className="relative">
                      <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Sin asignar"
                        value={prices[referrer.id] || ''}
                        onChange={(e) => handlePriceChange(referrer.id, e.target.value)}
                        onBlur={() => {
                            const currentPrice = prices[referrer.id];
                            if(currentPrice !== '' && currentPrice != null) {
                                handleSavePrice(referrer.id);
                            } else {
                                handleRemovePrice(referrer.id);
                            }
                        }}
                        className="w-32 pl-7 bg-white/80 dark:bg-slate-800/80"
                        disabled={isActionDisabled}
                      />
                    </div>
                  </div>
                </div>
              ))
            ) : (
                <p className="text-center text-sm text-muted-foreground py-4">No se encontraron referentes que coincidan con la búsqueda.</p>
            )}
          </div>
        </ScrollArea>
        
        <DialogFooter className="mt-4">
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isActionDisabled}>Cerrar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StudyPriceAssignmentModal;