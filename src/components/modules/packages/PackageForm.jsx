import React, { useState, useEffect } from 'react';
    import { Label } from '@/components/ui/label';
    import { Input } from '@/components/ui/input';
    import { Button } from '@/components/ui/button';
    import { Textarea } from '@/components/ui/textarea';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
    import { Checkbox } from "@/components/ui/checkbox";
    import { Search, Sparkles, PackagePlus, Beaker as BeakerIcon, Package as LayersIcon, DollarSign, ArrowUp, ArrowDown, X as CloseIcon, GripVertical } from 'lucide-react';

    const PackageForm = ({ 
      isOpen, 
      onOpenChange, 
      currentPackage: initialCurrentPackage, 
      onSubmit, 
      availableStudies, 
      availablePackagesForSelection, 
      initialPackageForm,
      handleAIAssistPackage,
      isSubmitting,
      closeForm
    }) => {
      const embedded = typeof isOpen === 'undefined'; // embedded mode when wrapped by external dialog
      const [currentPackage, setCurrentPackage] = useState(initialCurrentPackage || initialPackageForm);
  const [studySearchTerm, setStudySearchTerm] = useState('');
  const [packageSearchTerm, setPackageSearchTerm] = useState('');

      useEffect(() => {
        const pkg = initialCurrentPackage || initialPackageForm;
        setCurrentPackage({
            ...pkg,
            items: Array.isArray(pkg.items) ? pkg.items : []
        });

        if (!isOpen) {
            setStudySearchTerm('');
            setPackageSearchTerm('');
        }
      }, [initialCurrentPackage, isOpen, initialPackageForm]);

      const handleInputChange = (e) => {
        const { name, value } = e.target;
        setCurrentPackage(prev => ({ ...prev, [name]: value }));
      };

      const handleItemSelectionChange = (itemId, itemType) => {
        setCurrentPackage(prev => {
            const currentItems = Array.isArray(prev.items) ? prev.items : [];
            const itemExists = currentItems.some(item => item.item_id === itemId && item.item_type === itemType);
            
            let newItems;
            if (itemExists) {
                newItems = currentItems.filter(item => !(item.item_id === itemId && item.item_type === itemType));
            } else {
                newItems = [...currentItems, { item_id: itemId, item_type: itemType }];
            }
            
            return { ...prev, items: newItems };
        });
      };

      // Orden: mover arriba/abajo dentro del arreglo items
      const moveItem = (index, direction) => {
        setCurrentPackage(prev => {
          const items = Array.isArray(prev.items) ? [...prev.items] : [];
          const newIndex = index + direction;
          if (newIndex < 0 || newIndex >= items.length) return prev; // fuera de rango
          const temp = items[index];
          items[index] = items[newIndex];
          items[newIndex] = temp;
          return { ...prev, items };
        });
      };
      const moveItemUp = (idx) => moveItem(idx, -1);
      const moveItemDown = (idx) => moveItem(idx, +1);
      const removeAt = (idx) => {
        setCurrentPackage(prev => {
          const items = Array.isArray(prev.items) ? [...prev.items] : [];
          if (idx < 0 || idx >= items.length) return prev;
          items.splice(idx, 1);
          return { ...prev, items };
        });
      };

      const handleSubmitForm = (e) => {
        e.preventDefault();
        onSubmit(currentPackage);
      };

      // Helpers: búsqueda amplia y tolerante a acentos/espacios
      const normalize = (s) => (s || '')
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // quita acentos
        .toLowerCase();

      const matchesSearch = (text, term) => {
        const nTerm = normalize(term).trim();
        if (!nTerm) return true; // sin término => no filtra
        const tokens = nTerm.split(/\s+/g);
        const haystack = normalize(text || '');
        return tokens.every(t => haystack.includes(t));
      };

      // Build a quick lookup of selected items for fast checks
      // Normalize backend 'analysis' to 'study' so matching works
      const selectedKeySet = new Set(
        (Array.isArray(currentPackage.items) ? currentPackage.items : [])
          .map(it => `${it.item_type === 'analysis' ? 'study' : it.item_type}:${it.item_id}`)
      );

      const filteredAvailableStudies = availableStudies.filter(study => {
        if (!study) return false;
        const combined = [
          study.name,
          study.clave,
          study.code,
          study.category,
          study.description,
        ].filter(Boolean).join(' | ');
        return matchesSearch(combined, studySearchTerm);
      })
      // Selected first, then by name asc
      .sort((a, b) => {
        const aSel = selectedKeySet.has(`study:${a.id}`) ? 1 : 0;
        const bSel = selectedKeySet.has(`study:${b.id}`) ? 1 : 0;
        if (aSel !== bSel) return bSel - aSel; // selected first
        const an = (a.name || '').localeCompare(b.name || undefined, 'es', { sensitivity: 'base' });
        return an;
      });

      const filteredAvailablePackagesForSelection = availablePackagesForSelection.filter(pkg => {
        if (!pkg) return false;
        const combined = [pkg.name, pkg.description].filter(Boolean).join(' | ');
        return matchesSearch(combined, packageSearchTerm);
      })
      // Selected first, then by name asc
      .sort((a, b) => {
        const aSel = selectedKeySet.has(`package:${a.id}`) ? 1 : 0;
        const bSel = selectedKeySet.has(`package:${b.id}`) ? 1 : 0;
        if (aSel !== bSel) return bSel - aSel; // selected first
        return (a.name || '').localeCompare(b.name || undefined, 'es', { sensitivity: 'base' });
      });

      const getDisplayName = (item) => {
        const typeNorm = item.item_type === 'analysis' ? 'study' : item.item_type;
        if (typeNorm === 'study') {
          const s = availableStudies.find(st => st.id === item.item_id);
          if (s) return `${s.name}${s.clave ? ` (${s.clave})` : ''}`;
          return `Estudio ${item.item_id}`;
        }
        if (typeNorm === 'package') {
          const p = availablePackagesForSelection.find(pk => pk.id === item.item_id);
          if (p) return p.name;
          return `Paquete ${item.item_id}`;
        }
        return `${typeNorm}:${item.item_id}`;
      };

      // Drag & Drop soporte simple (HTML5) para reordenar
      const [dragIndex, setDragIndex] = useState(null);
      const handleDragStart = (e, idx) => {
        setDragIndex(idx);
        try {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', String(idx));
        } catch(err) {
          // Silenciar fallos en navegadores que no soportan setData
        }
      };
      const handleDragOver = (e, overIdx) => {
        e.preventDefault(); // permitir drop
        if (dragIndex === null || dragIndex === overIdx) return;
      };
      const handleDrop = (e, dropIdx) => {
        e.preventDefault();
        setCurrentPackage(prev => {
          if (dragIndex === null || dragIndex === dropIdx) return prev;
          const items = Array.isArray(prev.items) ? [...prev.items] : [];
          if (dragIndex < 0 || dragIndex >= items.length || dropIdx < 0 || dropIdx >= items.length) return prev;
          const [moved] = items.splice(dragIndex, 1);
          items.splice(dropIdx, 0, moved);
          return { ...prev, items };
        });
        setDragIndex(null);
      };
      const handleDragEnd = () => setDragIndex(null);

  const formCore = (
    <form onSubmit={handleSubmitForm} className="grid gap-4 py-4 px-2">
              <div>
                <Label htmlFor="name" className="text-slate-700 dark:text-slate-300">Nombre del Paquete</Label>
                <Input id="name" name="name" value={currentPackage.name} onChange={handleInputChange} placeholder="Ej: Perfil Básico, Checkup Completo" className="bg-white/80 dark:bg-slate-800/80" required minLength={2} />
              </div>
              <div>
                <Label htmlFor="description" className="text-slate-700 dark:text-slate-300">Descripción</Label>
                <Textarea id="description" name="description" value={currentPackage.description} onChange={handleInputChange} placeholder="Breve descripción del paquete" className="bg-white/80 dark:bg-slate-800/80" />
              </div>
              <div>
                <Label htmlFor="particularPrice" className="text-slate-700 dark:text-slate-300 flex items-center">
                  <DollarSign className="h-4 w-4 mr-1 text-green-600 dark:text-green-400"/> Precio Base (Particular)
                </Label>
                <Input 
                  id="particularPrice" 
                  name="particularPrice" 
                  type="number"
                  value={currentPackage.particularPrice} 
                  onChange={handleInputChange} 
                  placeholder="0.00" 
                  min="0"
                  step="0.01"
                  className="bg-white/80 dark:bg-slate-800/80" 
                  required 
                />
              </div>
              
              <div>
                <Label className="text-slate-700 dark:text-slate-300 mb-2 block">Items Incluidos (Estudios y Paquetes)</Label>
                <div className="space-y-4">
                  {/* Orden actual (arrastrar con botones subir/bajar) */}
                  <div>
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Orden de ítems seleccionados</p>
                    {Array.isArray(currentPackage.items) && currentPackage.items.length > 0 ? (
                      <div className="max-h-40 overflow-y-auto border rounded-md p-2 bg-white/70 dark:bg-slate-800/50 space-y-2">
                        {currentPackage.items.map((it, idx) => {
                          const isDragging = dragIndex === idx;
                          return (
                            <div
                              key={`${it.item_type}:${it.item_id}:${idx}`}
                              className={`flex items-center justify-between gap-2 p-1.5 rounded bg-slate-100 dark:bg-slate-800 border border-transparent hover:border-sky-300 dark:hover:border-sky-600 transition ${isDragging ? 'opacity-60 ring-2 ring-sky-400' : ''}`}
                              draggable
                              onDragStart={(e) => handleDragStart(e, idx)}
                              onDragOver={(e) => handleDragOver(e, idx)}
                              onDrop={(e) => handleDrop(e, idx)}
                              onDragEnd={handleDragEnd}
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <button type="button" className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200" title="Arrastrar para reordenar">
                                  <GripVertical className="h-4 w-4" />
                                </button>
                                <div className="text-sm text-slate-800 dark:text-slate-200 truncate flex-1">
                                  {getDisplayName(it)}
                                  <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 uppercase">{it.item_type === 'analysis' ? 'study' : it.item_type}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button type="button" variant="ghost" size="icon" onClick={() => moveItemUp(idx)} disabled={idx === 0} title="Subir">
                                  <ArrowUp className="h-4 w-4" />
                                </Button>
                                <Button type="button" variant="ghost" size="icon" onClick={() => moveItemDown(idx)} disabled={idx === currentPackage.items.length - 1} title="Bajar">
                                  <ArrowDown className="h-4 w-4" />
                                </Button>
                                <Button type="button" variant="ghost" size="icon" onClick={() => removeAt(idx)} title="Quitar">
                                  <CloseIcon className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No hay ítems seleccionados aún.</p>
                    )}
                  </div>
                  <div>
                    <div className="relative mb-2">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input 
                        type="search" 
                        placeholder="Buscar estudios por nombre, clave o categoría..." 
                        value={studySearchTerm}
                        onChange={(e) => setStudySearchTerm(e.target.value)}
                        className="pl-8 bg-white/80 dark:bg-slate-800/80"
                      />
                    </div>
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Estudios:</p>
                    <div className="max-h-40 overflow-y-auto border rounded-md p-2 bg-slate-100/50 dark:bg-slate-800/50 space-y-2">
                      {filteredAvailableStudies.length > 0 ? (
                        filteredAvailableStudies.map(study => (
                          <div key={`study-${study.id}`} className="flex items-center space-x-2 p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700">
                            <Checkbox
                              id={`item-${study.id}-study`}
                              checked={currentPackage.items.some(item => item.item_id === study.id && (item.item_type === 'study' || item.item_type === 'analysis'))}
                              onCheckedChange={() => handleItemSelectionChange(study.id, 'study')}
                            />
                            <label
                              htmlFor={`item-${study.id}-study`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-700 dark:text-slate-300"
                            >
                              <BeakerIcon className="h-3 w-3 inline mr-1 text-blue-500"/> {study.name} <span className="text-xs text-muted-foreground">({study.clave})</span>
                            </label>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No hay estudios disponibles (o que coincidan con la búsqueda).</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="relative mb-2">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input 
                        type="search" 
                        placeholder="Buscar paquetes por nombre o descripción..." 
                        value={packageSearchTerm}
                        onChange={(e) => setPackageSearchTerm(e.target.value)}
                        className="pl-8 bg-white/80 dark:bg-slate-800/80"
                      />
                    </div>
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 pt-2">Paquetes:</p>
                    <div className="max-h-40 overflow-y-auto border rounded-md p-2 bg-slate-100/50 dark:bg-slate-800/50 space-y-2">
                      {filteredAvailablePackagesForSelection.length > 0 ? (
                        filteredAvailablePackagesForSelection.map(pkg => (
                          <div key={`pkg-${pkg.id}`} className="flex items-center space-x-2 p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700">
                            <Checkbox
                              id={`item-${pkg.id}-package`}
                              checked={currentPackage.items.some(item => item.item_id === pkg.id && item.item_type === 'package')}
                              onCheckedChange={() => handleItemSelectionChange(pkg.id, 'package')}
                            />
                            <label
                              htmlFor={`item-${pkg.id}-package`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-700 dark:text-slate-300"
                            >
                              <LayersIcon className="h-3 w-3 inline mr-1 text-green-500"/> {pkg.name}
                            </label>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No hay otros paquetes disponibles para agregar (o que coincidan con la búsqueda).</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="mt-2">
                {embedded ? (
                  <Button type="button" variant="outline" onClick={closeForm}>Cancelar</Button>
                ) : (
                  <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
                )}
                <Button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 text-white">
                  {isSubmitting ? 'Guardando...' : (currentPackage.id ? 'Guardar Cambios' : 'Registrar Paquete')}
                </Button>
              </DialogFooter>
            </form>
      );

      if (embedded) {
        // Render only form (used inside external dialog wrapper)
        return (
          <div className="max-h-[70vh] overflow-y-auto">
            <div className="flex items-center mb-2">
              <h3 className="text-lg font-semibold text-sky-700 dark:text-sky-400 flex-1">{currentPackage.id ? 'Editar Paquete' : 'Registrar Nuevo Paquete'}</h3>
              {handleAIAssistPackage && (
                <Button variant="ghost" size="sm" onClick={handleAIAssistPackage} className="text-purple-500 hover:text-purple-700">
                  <Sparkles className="mr-2 h-4 w-4" /> IA
                </Button>
              )}
            </div>
            {formCore}
          </div>
        );
      }

      return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 text-white" onClick={() => setCurrentPackage(initialPackageForm)}>
              <PackagePlus className="mr-2 h-4 w-4" /> Nuevo Paquete
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg bg-slate-50 dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-sky-700 dark:text-sky-400 flex items-center">
                {currentPackage.id ? 'Editar Paquete' : 'Registrar Nuevo Paquete'}
                 <Button variant="ghost" size="sm" onClick={handleAIAssistPackage} className="ml-auto text-purple-500 hover:text-purple-700">
                  <Sparkles className="mr-2 h-4 w-4" /> Asistente IA
                </Button>
              </DialogTitle>
              <DialogDescription>Define los detalles del paquete, su precio base para &quot;Particular&quot;, y los estudios o paquetes que incluye.</DialogDescription>
            </DialogHeader>
            {formCore}
          </DialogContent>
        </Dialog>
      );
    };

    export default PackageForm;