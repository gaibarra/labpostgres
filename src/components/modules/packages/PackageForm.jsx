import React, { useState, useEffect } from 'react';
    import { Label } from '@/components/ui/label';
    import { Input } from '@/components/ui/input';
    import { Button } from '@/components/ui/button';
    import { Textarea } from '@/components/ui/textarea';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
    import { Checkbox } from "@/components/ui/checkbox";
    import { Search, Sparkles, PackagePlus, Beaker as BeakerIcon, Package as LayersIcon, DollarSign } from 'lucide-react';

    const PackageForm = ({ 
      isOpen, 
      onOpenChange, 
      currentPackage: initialCurrentPackage, 
      onSubmit, 
      availableStudies, 
      availablePackagesForSelection, 
      initialPackageForm,
      handleAIAssistPackage,
      isSubmitting
    }) => {
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

      const handleSubmitForm = (e) => {
        e.preventDefault();
        onSubmit(currentPackage);
      };

      const filteredAvailableStudies = availableStudies.filter(study => 
        study && study.name && study.name.toLowerCase().includes(studySearchTerm.toLowerCase())
      );

      const filteredAvailablePackagesForSelection = availablePackagesForSelection.filter(pkg =>
        pkg && pkg.name && pkg.name.toLowerCase().includes(packageSearchTerm.toLowerCase())
      );

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
              <DialogDescription>Define los detalles del paquete, su precio base para "Particular", y los estudios o paquetes que incluye.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmitForm} className="grid gap-4 py-4 px-2">
              <div>
                <Label htmlFor="name" className="text-slate-700 dark:text-slate-300">Nombre del Paquete</Label>
                <Input id="name" name="name" value={currentPackage.name} onChange={handleInputChange} placeholder="Ej: Perfil Básico, Checkup Completo" className="bg-white/80 dark:bg-slate-800/80" required />
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
                  <div>
                    <div className="relative mb-2">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input 
                        type="search" 
                        placeholder="Buscar estudios..." 
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
                              checked={currentPackage.items.some(item => item.item_id === study.id && item.item_type === 'study')}
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
                        placeholder="Buscar paquetes..." 
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

              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
                <Button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 text-white">
                  {isSubmitting ? 'Guardando...' : (currentPackage.id ? 'Guardar Cambios' : 'Registrar Paquete')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      );
    };

    export default PackageForm;