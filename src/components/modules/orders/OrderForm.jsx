import React, { useState, useEffect, useCallback } from 'react';
    import { Label } from '@/components/ui/label';
    import { Input } from '@/components/ui/input';
    import { Button } from '@/components/ui/button';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
    import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
    import { format } from 'date-fns';
    import { es } from 'date-fns/locale';
    import { DialogFooter } from "@/components/ui/dialog";
    import SearchableSelect from '@/components/ui/SearchableSelect';
    import { User, Package as PackageIcon, Trash2, Beaker, FileText, Stethoscope, Hash } from 'lucide-react';
    import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
    import OrderPreviewModal from './OrderPreviewModal';
    import { AnimatePresence, motion } from 'framer-motion';

    const initialOrderFormState = {
      id: null,
      folio: '',
      order_date: new Date(),
      patient_id: '',
      referring_entity_id: '',
      referring_doctor_id: null,
      institution_reference: '',
      selected_items: [],
      subtotal: 0,
      descuento: 0,
      total_price: 0,
      anticipo: 0,
      saldoPendiente: 0,
      status: 'Pendiente',
      notas: '',
    };

    const orderStatusOptions = ["Pendiente", "Procesando", "Concluida", "Reportada", "Cancelada"];

    const OrderForm = ({ initialOrderData, onSubmit, patients, referrers, studies, packages, onClose, isSubmitting, referrerRef }) => {
      const [order, setOrder] = useState(initialOrderFormState);
      const [isPreviewOpen, setIsPreviewOpen] = useState(false);
      const [showReferringDoctorField, setShowReferringDoctorField] = useState(false);

      useEffect(() => {
        if (initialOrderData) {
          const selectedReferrer = referrers.find(r => r.id === initialOrderData.referring_entity_id);
          setShowReferringDoctorField(selectedReferrer?.entity_type === 'Institución');
          setOrder({
            ...initialOrderFormState, 
            ...initialOrderData,
            order_date: initialOrderData.order_date ? new Date(initialOrderData.order_date) : new Date(),
            selected_items: initialOrderData.selected_items || [],
            referring_doctor_id: initialOrderData.referring_doctor_id || null,
            institution_reference: initialOrderData.institution_reference || '',
          });
        } else {
          setOrder({...initialOrderFormState, order_date: new Date()});
        }
      }, [initialOrderData, referrers]);

      const patientOptions = patients.map(p => ({ value: p.id, label: p.full_name, id: p.id }));
      const referrerOptions = referrers.map(r => ({ value: r.id, label: `${r.name} (${r.entity_type})`, id: r.id }));
      const doctorOptions = referrers.filter(r => r.entity_type === 'Médico').map(d => ({ value: d.id, label: d.name, id: d.id }));
      
      const getPriceForItem = useCallback((itemId, itemType, targetReferrerId, visitedPackages = new Set()) => {
        if (itemType === 'package' && visitedPackages.has(itemId)) {
          console.warn(`Referencia circular detectada para el paquete ID: ${itemId}. Se asignará precio 0 para evitar bucle.`);
          return 0; 
        }
      
        const sourceArray = itemType === 'study' ? studies : packages;
        const itemData = sourceArray.find(s => s.id === itemId);
        if (!itemData) return 0;
      
        const selectedReferrer = referrers.find(r => r.id === targetReferrerId);
        const particularReferrer = referrers.find(r => r.name?.toLowerCase() === 'particular');
        let price = 0;
      
        const priceListKey = itemType === 'study' ? 'studies' : 'packages';
      
        const findPriceInList = (list, id) => {
            if (list && Array.isArray(list[priceListKey])) {
                const entry = list[priceListKey].find(p => p.itemId === id);
                if (entry && entry.price !== null && entry.price !== undefined && parseFloat(entry.price) >= 0) {
                    return parseFloat(entry.price);
                }
            }
            return null;
        };

        let specificPrice = findPriceInList(selectedReferrer?.listaprecios, itemId);
        if (specificPrice !== null) {
            price = specificPrice;
        } else {
            let particularPrice = findPriceInList(particularReferrer?.listaprecios, itemId);
            price = particularPrice !== null ? particularPrice : 0;
        }
        
        if (itemType === 'package') {
          const currentVisitedPackages = new Set(visitedPackages);
          currentVisitedPackages.add(itemId);

          if (price === 0 && Array.isArray(itemData.items)) {
            let packageSum = 0;
            itemData.items.forEach(subItem => {
              packageSum += getPriceForItem(subItem.id, subItem.type, targetReferrerId, currentVisitedPackages);
            });
            price = packageSum;
          }
        }
        return price;
      }, [studies, packages, referrers]);


      const studyOptions = studies.map(s => ({ 
        value: s.id, 
        label: `${s.name} (${s.clave})`, 
        id: s.id, 
      }));

      const packageOptions = packages.map(p => ({ 
        value: p.id, 
        label: p.name, 
        id: p.id, 
        items: p.items || []
      }));

      const calculateTotals = useCallback((currentOrder) => {
        const subtotal = currentOrder.selected_items.reduce((sum, item) => sum + (parseFloat(item.precio) || 0), 0);
        const descuento = parseFloat(currentOrder.descuento) || 0;
        const total_price = subtotal - descuento;
        const anticipo = parseFloat(currentOrder.anticipo) || 0;
        const saldoPendiente = total_price - anticipo;
        return { ...currentOrder, subtotal, total_price, anticipo, saldoPendiente };
      }, []);

      const addItemToOrder = useCallback((itemType, itemId) => {
        const source = itemType === 'study' ? studies : packages;
        const itemData = source.find(s => s.id === itemId);
        if (!itemData) return;

        const precio = getPriceForItem(itemId, itemType, order.referring_entity_id);
        const newItem = { type: itemType, id: itemId, nombre: itemData.name, precio: precio };
        
        setOrder(prevOrder => calculateTotals({ ...prevOrder, selected_items: [...prevOrder.selected_items, newItem] }));
      }, [studies, packages, order.referring_entity_id, getPriceForItem, calculateTotals]);

      const removeItemFromOrder = useCallback((index) => {
        const updatedItems = order.selected_items.filter((_, i) => i !== index);
        setOrder(prevOrder => calculateTotals({ ...prevOrder, selected_items: updatedItems }));
      }, [order.selected_items, calculateTotals]);

      const handleInputChange = (e) => {
        const { name, value } = e.target;
        let newOrder = { ...order, [name]: value };
        if (name === 'anticipo' || name === 'descuento') {
          newOrder = calculateTotals(newOrder);
        }
        setOrder(newOrder);
      };

      const handleSelectChange = (name, value) => {
        let newOrder = { ...order, [name]: value };
         if (name === 'referring_entity_id' && order.selected_items.length > 0) {
            const updatedItems = newOrder.selected_items.map(item => ({
                ...item,
                precio: getPriceForItem(item.id, item.type, value)
            }));
            newOrder = { ...newOrder, selected_items: updatedItems };
        }
        newOrder = calculateTotals(newOrder);
        setOrder(newOrder);
      };
      
      const handleSearchableSelectChange = (name, value) => {
        let newOrder = { ...order, [name]: value };
        if (name === 'referring_entity_id') {
            const selectedReferrer = referrers.find(r => r.id === value);
            const isInstitution = selectedReferrer?.entity_type === 'Institución';
            setShowReferringDoctorField(isInstitution);
            if (!isInstitution) {
                newOrder.referring_doctor_id = null;
                newOrder.institution_reference = '';
            }

            if (order.selected_items.length > 0) {
                const updatedItems = newOrder.selected_items.map(item => ({
                    ...item,
                    precio: getPriceForItem(item.id, item.type, value)
                }));
                newOrder = { ...newOrder, selected_items: updatedItems };
            }
        }
        newOrder = calculateTotals(newOrder);
        setOrder(newOrder);
      };

      const localHandleSubmit = (e) => {
        e.preventDefault();
        const finalOrder = calculateTotals(order);
        onSubmit(finalOrder);
      };
      
      useEffect(() => {
        setOrder(prevOrder => calculateTotals(prevOrder));
      }, [order.selected_items, order.descuento, order.anticipo, calculateTotals]);

      return (
        <>
          <form onSubmit={localHandleSubmit} className="grid gap-6 py-4 px-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="order_date" className="text-slate-700 dark:text-slate-300">Fecha de Orden</Label>
                <Input
                  id="order_date"
                  type="text"
                  value={order.order_date ? format(order.order_date, 'PPPP', { locale: es }) : ''}
                  readOnly
                  className="bg-slate-200/80 dark:bg-slate-700/80 cursor-not-allowed"
                />
              </div>
              <div>
                <Label htmlFor="patient_id" className="text-slate-700 dark:text-slate-300">Paciente</Label>
                <SearchableSelect
                  options={patientOptions}
                  value={order.patient_id}
                  onValueChange={(value) => handleSearchableSelectChange('patient_id', value)}
                  placeholder="Seleccione paciente"
                  searchPlaceholder="Buscar paciente..."
                />
              </div>
              <div>
                <Label htmlFor="referring_entity_id" className="text-slate-700 dark:text-slate-300">Referente</Label>
                <SearchableSelect
                  ref={referrerRef}
                  options={referrerOptions}
                  value={order.referring_entity_id}
                  onValueChange={(value) => handleSearchableSelectChange('referring_entity_id', value)}
                  placeholder="Seleccione referente"
                  searchPlaceholder="Buscar referente..."
                />
              </div>
            </div>

            <AnimatePresence>
              {showReferringDoctorField && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden grid md:grid-cols-2 gap-4"
                >
                  <div className="">
                    <Label htmlFor="referring_doctor_id" className="text-slate-700 dark:text-slate-300 flex items-center">
                      <Stethoscope className="h-4 w-4 mr-2" /> Médico que Refiere
                    </Label>
                    <SearchableSelect
                      options={doctorOptions}
                      value={order.referring_doctor_id}
                      onValueChange={(value) => handleSearchableSelectChange('referring_doctor_id', value)}
                      placeholder="Seleccione médico"
                      searchPlaceholder="Buscar médico..."
                    />
                  </div>
                  <div className="">
                    <Label htmlFor="institution_reference" className="text-slate-700 dark:text-slate-300 flex items-center">
                      <Hash className="h-4 w-4 mr-2" /> Referencia de Institución
                    </Label>
                    <Input
                      id="institution_reference"
                      name="institution_reference"
                      value={order.institution_reference || ''}
                      onChange={handleInputChange}
                      placeholder="Ej. OR-12345"
                      className="bg-white/80 dark:bg-slate-800/80"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <Card>
              <CardHeader><CardTitle className="text-base">Estudios y Paquetes</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-700 dark:text-slate-300">Añadir Estudio</Label>
                    <SearchableSelect
                      options={studyOptions}
                      value={''}
                      onValueChange={(value) => addItemToOrder('study', value)}
                      placeholder="Seleccione un estudio"
                      searchPlaceholder="Buscar estudio..."
                      disabled={!order.referring_entity_id}
                    />
                  </div>
                  <div>
                    <Label className="text-slate-700 dark:text-slate-300">Añadir Paquete</Label>
                    <SearchableSelect
                      options={packageOptions}
                      value={''}
                      onValueChange={(value) => addItemToOrder('package', value)}
                      placeholder="Seleccione un paquete"
                      searchPlaceholder="Buscar paquete..."
                      disabled={!order.referring_entity_id}
                    />
                  </div>
                </div>
                {order.selected_items.length > 0 && (
                  <div className="overflow-x-auto max-h-60">
                    <Table>
                      <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Nombre</TableHead><TableHead>Precio</TableHead><TableHead>Acción</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {order.selected_items.map((item, index) => (
                          <TableRow key={`${item.id}-${index}`}>
                            <TableCell>{item.type === 'study' ? <Beaker className="h-4 w-4 inline mr-1"/> : <PackageIcon className="h-4 w-4 inline mr-1"/>}{item.type === 'study' ? 'Estudio' : 'Paquete'}</TableCell>
                            <TableCell>{item.nombre}</TableCell>
                            <TableCell>{(item.precio || 0).toFixed(2)}</TableCell>
                            <TableCell><Button type="button" variant="ghost" size="icon" onClick={() => removeItemFromOrder(index)} className="text-red-500"><Trash2 className="h-4 w-4"/></Button></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                    <Label htmlFor="subtotal" className="text-slate-700 dark:text-slate-300">Subtotal</Label>
                    <Input id="subtotal" name="subtotal" type="number" value={order.subtotal.toFixed(2)} readOnly className="bg-slate-200/80 dark:bg-slate-700/80" />
                </div>
                <div>
                    <Label htmlFor="descuento" className="text-slate-700 dark:text-slate-300">Descuento (MXN)</Label>
                    <Input id="descuento" name="descuento" type="number" step="0.01" value={order.descuento} onChange={handleInputChange} placeholder="0.00" className="bg-white/80 dark:bg-slate-800/80" />
                </div>
                <div>
                    <Label htmlFor="total_price" className="text-slate-700 dark:text-slate-300">Total</Label>
                    <Input id="total_price" name="total_price" type="number" value={order.total_price.toFixed(2)} readOnly className="bg-slate-200/80 dark:bg-slate-700/80 font-bold" />
                </div>
                 <div>
                    <Label htmlFor="status" className="text-slate-700 dark:text-slate-300">Estado de Orden</Label>
                    <Select name="status" value={order.status} onValueChange={(value) => handleSelectChange('status', value)}>
                      <SelectTrigger className="bg-white/80 dark:bg-slate-800/80"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {orderStatusOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="anticipo" className="text-slate-700 dark:text-slate-300">Anticipo (MXN)</Label>
                    <Input id="anticipo" name="anticipo" type="number" step="0.01" value={order.anticipo} onChange={handleInputChange} placeholder="0.00" className="bg-white/80 dark:bg-slate-800/80" />
                </div>
                <div>
                    <Label htmlFor="saldoPendiente" className="text-slate-700 dark:text-slate-300">Saldo Pendiente</Label>
                    <Input id="saldoPendiente" name="saldoPendiente" type="number" value={order.saldoPendiente.toFixed(2)} readOnly className="bg-slate-200/80 dark:bg-slate-700/80" />
                </div>
             </div>
             <div>
                <Label htmlFor="notas" className="text-slate-700 dark:text-slate-300">Notas Adicionales</Label>
                <Input id="notas" name="notas" value={order.notas} onChange={handleInputChange} placeholder="Observaciones sobre la orden..." className="bg-white/80 dark:bg-slate-800/80" />
             </div>

            <DialogFooter className="pt-4 flex-col sm:flex-row sm:justify-between w-full">
                <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsPreviewOpen(true)} disabled={!order.patient_id}>
                        <FileText className="mr-2 h-4 w-4" /> Ver Comprobante
                    </Button>
                </div>
                <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
                    <Button type="submit" className="bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 text-white" disabled={isSubmitting || !order.patient_id}>
                      {isSubmitting ? 'Guardando...' : (order.id ? 'Guardar Cambios' : 'Registrar Orden')}
                    </Button>
                </div>
            </DialogFooter>
          </form>

          {isPreviewOpen && (
            <OrderPreviewModal
              isOpen={isPreviewOpen}
              onOpenChange={setIsPreviewOpen}
              order={order}
              patient={patients.find(p => p.id === order.patient_id)}
              referrer={referrers.find(r => r.id === order.referring_entity_id)}
              studiesDetails={studies}
              packagesData={packages}
            />
          )}
        </>
      );
    };

    export default OrderForm;