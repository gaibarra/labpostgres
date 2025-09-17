import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { DollarSign, ListPlus, Trash2, Loader2 } from 'lucide-react';
import SearchableSelect from '@/components/ui/SearchableSelect';

const PriceListModal = ({ 
  isOpen, 
  onOpenChange, 
  referrer, 
  studies, 
  packagesData, 
  onUpdateReferrerPrices,
  particularReferrer,
  isParentSubmitting
}) => {
  const { toast } = useToast();
  const [itemType, setItemType] = useState('study');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [specificPrice, setSpecificPrice] = useState('');
  const [currentPriceList, setCurrentPriceList] = useState({ studies: [], packages: [] });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isActionDisabled = isParentSubmitting || isSubmitting;

  useEffect(() => {
    if (referrer) {
      setCurrentPriceList({ 
        studies: Array.isArray(referrer.listaprecios?.studies) ? referrer.listaprecios.studies : [],
        packages: Array.isArray(referrer.listaprecios?.packages) ? referrer.listaprecios.packages : []
      });
    }
  }, [referrer, isOpen]);

  const studyOptions = studies.map(s => ({ value: s.id, label: `${s.clave} - ${s.name}` }));
  const packageOptions = packagesData.map(p => ({ value: p.id, label: p.name }));

  const getItemNameById = (type, id) => {
    const list = type === 'study' ? studies : packagesData;
    const item = list.find(i => i.id === id);
    return item ? (item.clave ? `${item.clave} - ${item.name}` : item.name) : 'Desconocido';
  };
  
  const getBasePrice = useCallback((type, id) => {
    if (referrer?.name === 'Particular' || !particularReferrer?.listaprecios) {
      return '';
    }
  
    const listKey = type === 'study' ? 'studies' : 'packages';
    // Asegurarse de que la lista (studies o packages) exista antes de usar find
    const priceList = particularReferrer.listaprecios[listKey] || [];
    const priceEntry = priceList.find(p => p.itemId === id);
    
    return priceEntry?.price != null ? `(Base: ${parseFloat(priceEntry.price).toFixed(2)})` : '(Base: N/A)';
  }, [referrer, particularReferrer]);

  const handleAddItem = async () => {
    if (!selectedItemId || specificPrice === '') {
      toast({ title: "Datos incompletos", description: "Seleccione un ítem e ingrese un precio.", variant: "destructive" });
      return;
    }
    const price = parseFloat(specificPrice);
    if (isNaN(price) || price < 0) {
      toast({ title: "Precio Inválido", description: "Por favor, ingrese un precio numérico válido.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    const listKey = itemType === 'study' ? 'studies' : 'packages';
    const newList = [...(currentPriceList[listKey] || [])];
    const existingItemIndex = newList.findIndex(item => item.itemId === selectedItemId);

    if (existingItemIndex > -1) {
      newList[existingItemIndex].price = price;
    } else {
      newList.push({ itemId: selectedItemId, price, itemType });
    }
    
    const updatedPriceList = { ...currentPriceList, [listKey]: newList };
    const success = await onUpdateReferrerPrices(referrer.id, updatedPriceList);
    
    if (success) {
      setCurrentPriceList(updatedPriceList);
      toast({ title: "Precio Guardado", description: `El precio para ${getItemNameById(itemType, selectedItemId)} se guardó.` });
      setSelectedItemId('');
      setSpecificPrice('');
    }
    setIsSubmitting(false);
  };

  const handleRemoveItem = async (type, itemId) => {
    setIsSubmitting(true);
    const listKey = type === 'study' ? 'studies' : 'packages';
    const newList = (currentPriceList[listKey] || []).filter(item => item.itemId !== itemId);
    const updatedPriceList = { ...currentPriceList, [listKey]: newList };
    
    const success = await onUpdateReferrerPrices(referrer.id, updatedPriceList);
    
    if (success) {
      setCurrentPriceList(updatedPriceList);
      toast({ title: "Precio Eliminado", description: `El precio para ${getItemNameById(type, itemId)} se eliminó.`, variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  if (!referrer) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-slate-50 dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sky-700 dark:text-sky-400 flex items-center">
            <DollarSign className="h-6 w-6 mr-2 text-green-500" />
            Lista de Precios: {referrer.name}
          </DialogTitle>
          <DialogDescription>
            {referrer.name === 'Particular' 
              ? "Define los precios base para todos los estudios y paquetes."
              : "Define precios específicos. Si no se especifica un precio, se usará el de 'Particular'."}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <Label htmlFor="itemTypeForPrice" className="text-slate-700 dark:text-slate-300">Tipo de Ítem</Label>
              <Select value={itemType} onValueChange={(value) => { setItemType(value); setSelectedItemId(''); setSpecificPrice(''); }} disabled={isActionDisabled}>
                <SelectTrigger className="bg-white/80 dark:bg-slate-800/80"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="study">Estudio</SelectItem>
                  <SelectItem value="package">Paquete</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="selectedItemForPrice" className="text-slate-700 dark:text-slate-300">
                {itemType === 'study' ? 'Seleccionar Estudio' : 'Seleccionar Paquete'}
              </Label>
              <SearchableSelect
                options={itemType === 'study' ? studyOptions.map(o => ({...o, label: `${o.label} ${getBasePrice('study', o.value)}`})) : packageOptions.map(o => ({...o, label: `${o.label} ${getBasePrice('package', o.value)}`}))}
                value={selectedItemId}
                onValueChange={setSelectedItemId}
                placeholder={`Buscar ${itemType === 'study' ? 'estudio' : 'paquete'}...`}
                searchPlaceholder="Escribe para buscar..."
                notFoundMessage="No se encontraron ítems."
                disabled={isActionDisabled}
              />
            </div>
          </div>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-4 items-end'>
            <div className='md:col-span-2'>
                <Label htmlFor="specificPrice" className="text-slate-700 dark:text-slate-300">Precio Específico (MXN)</Label>
                <Input
                    id="specificPrice"
                    type="number"
                    step="0.01"
                    value={specificPrice}
                    onChange={(e) => setSpecificPrice(e.target.value)}
                    placeholder="0.00"
                    className="bg-white/80 dark:bg-slate-800/80"
                    disabled={isActionDisabled}
                />
            </div>
            <Button onClick={handleAddItem} className="w-full bg-green-500 hover:bg-green-600 text-white" disabled={isActionDisabled}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ListPlus className="mr-2 h-4 w-4" />}
              Añadir/Actualizar
            </Button>
          </div>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Precios de Estudios Asignados:</h4>
              {(currentPriceList.studies?.length || 0) > 0 ? (
                <Table>
                  <TableHeader><TableRow><TableHead>Estudio</TableHead><TableHead>Precio</TableHead><TableHead className="text-right">Acción</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {currentPriceList.studies.map(item => (
                      <TableRow key={item.itemId}>
                        <TableCell>{getItemNameById('study', item.itemId)}</TableCell>
                        <TableCell>{parseFloat(item.price).toFixed(2)} MXN</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleRemoveItem('study', item.itemId)} className="text-red-500 hover:text-red-700" disabled={isActionDisabled}><Trash2 className="h-4 w-4"/></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <p className="text-sm text-muted-foreground">No hay precios de estudios específicos para este referente.</p>}
            </div>
            <div>
              <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Precios de Paquetes Asignados:</h4>
              {(currentPriceList.packages?.length || 0) > 0 ? (
                <Table>
                  <TableHeader><TableRow><TableHead>Paquete</TableHead><TableHead>Precio</TableHead><TableHead className="text-right">Acción</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {currentPriceList.packages.map(item => (
                      <TableRow key={item.itemId}>
                        <TableCell>{getItemNameById('package', item.itemId)}</TableCell>
                        <TableCell>{parseFloat(item.price).toFixed(2)} MXN</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleRemoveItem('package', item.itemId)} className="text-red-500 hover:text-red-700" disabled={isActionDisabled}><Trash2 className="h-4 w-4"/></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <p className="text-sm text-muted-foreground">No hay precios de paquetes específicos para este referente.</p>}
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isActionDisabled}>Cerrar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PriceListModal;