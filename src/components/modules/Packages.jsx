import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { useToast } from "@/components/ui/use-toast";
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
// Migrated off Supabase: now uses REST endpoints via apiClient
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import { logAuditEvent } from '@/lib/auditUtils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMediaQuery } from '@/hooks/useMediaQuery';

import PackagesHeader from './packages/PackagesHeader';
import PackagesTable from './packages/PackagesTable';
import PackagesCardView from './packages/PackagesCardView';
import PackageFormDialog from './packages/PackageFormDialog';
import PackageHelpDialog from './packages/PackageHelpDialog';
import DeletePackageDialog from './packages/DeletePackageDialog';

const initialPackageForm = {
  id: null,
  name: '',
  description: '',
  items: [],
  particularPrice: '',
};

const Packages = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const isMobile = useMediaQuery("(max-width: 768px)");

  const [packages, setPackages] = useState([]);
  const [availableStudies, setAvailableStudies] = useState([]);
  const [availablePackagesForSelection, setAvailablePackagesForSelection] = useState([]);
  const [particularReferrer, setParticularReferrer] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentPackage, setCurrentPackage] = useState(initialPackageForm);
  const [packageToDelete, setPackageToDelete] = useState(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Get detailed packages with items aggregated
  const pkgResp = await apiClient.get('/packages/detailed?limit=5000');
      setPackages(pkgResp.data || []);
  const studiesResp = await apiClient.get('/analysis?limit=5000');
      setAvailableStudies(studiesResp.data || []);
      // Find 'Particular' referrer
      const refResp = await apiClient.get('/referrers?search=Particular&limit=1');
      const part = refResp.data?.find(r=>r.name==='Particular') || refResp.data?.[0] || null;
      setParticularReferrer(part);
    } catch (error) {
      toast({ title: 'Error al cargar datos', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [loadData, user]);

  useEffect(() => {
    if (isFormOpen) {
      if (currentPackage && currentPackage.id) {
        setAvailablePackagesForSelection(packages.filter(p => p.id !== currentPackage.id));
      } else {
        setAvailablePackagesForSelection(packages);
      }
    }
  }, [packages, currentPackage, isFormOpen]);
  
  const getParticularPrice = useCallback((packageId) => {
    if (particularReferrer?.listaprecios?.packages) {
      const priceEntry = particularReferrer.listaprecios.packages.find(p => p.itemId === packageId);
      return priceEntry?.price != null ? parseFloat(priceEntry.price).toFixed(2) : 'N/A';
    }
    return 'N/A';
  }, [particularReferrer]);

  const handleSubmit = async (packageData) => {
    setIsSubmitting(true);
     if (!particularReferrer) {
      toast({ title: "Error Crítico", description: "No se encontró el referente 'Particular'. No se puede registrar el paquete. Por favor, recargue la página.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }
    const { id, particularPrice, items, ...rest } = packageData;
    // Normalizar/validar antes de enviar
    const name = (rest.name || '').trim();
    const description = rest.description != null ? String(rest.description).trim() : undefined;
    const price = particularPrice != null && String(particularPrice).trim() !== '' ? Number(particularPrice) : undefined;
    if (name.length < 2) {
      toast({ title: 'Validación', description: 'El nombre del paquete debe tener al menos 2 caracteres.', variant: 'destructive' });
      setIsSubmitting(false);
      return;
    }
    const dataToSave = { name, description, price };

    try {
      let savedPackage;

      if (id) {
        // 1) Actualizar campos básicos del paquete
        await apiClient.put(`/packages/${id}`, dataToSave);
        await logAuditEvent('PaqueteActualizado', { packageId: id, packageName: dataToSave.name });
        toast({ title: '¡Paquete Actualizado!', description: `El paquete ${dataToSave.name} se actualizó con éxito.` });
        savedPackage = { id, ...dataToSave };
      } else {
        // 1) Crear paquete nuevo
        const created = await apiClient.post('/packages', dataToSave);
        savedPackage = created;
        await logAuditEvent('PaqueteCreado', { packageId: savedPackage.id, packageName: savedPackage.name });
        toast({ title: '¡Paquete Registrado!', description: `El paquete ${savedPackage.name} se guardó con éxito.` });
      }

      // 2) Sincronizar items de forma no destructiva (diff):
      //    - agregar los nuevos primero
      //    - si y sólo si todos los agregados (o duplicados benignos) pasan, eliminar los que sobran
      //    - finalmente, reordenar según el orden de UI
      const targetItems = Array.isArray(items) ? items.map(it => ({
        item_id: it.item_id,
        item_type: it.item_type === 'study' ? 'analysis' : it.item_type
      })) : [];

      // Obtener estado actual del backend
      const existing = id ? await apiClient.get(`/packages/${savedPackage.id}/items`) : [];
      // Mapear a conjuntos comparables por (item_id,item_type)
      const keyOf = (it) => `${it.item_type}:${it.item_id}`;
      const existingByKey = new Map(existing.map(it => [keyOf(it), it]));
      const targetKeys = new Set(targetItems.map(keyOf));

    const toAdd = targetItems.filter(it => !existingByKey.has(keyOf(it)));
  // (toKeepKeys se eliminó porque no se usa directamente; mantenemos lógica con toAdd y toRemove)
    const toRemove = existing.filter(it => !targetKeys.has(keyOf(it)));
    const keptCount = existing.length - toRemove.length; // ítems que ya existían y se mantienen
    // Variables para resumen
    let duplicateAddCount = 0; // intentos de agregar que resultaron ser duplicados benignos
    let reorderOk = null; // null = no intentado, true/false según resultado
    let reorderAttempted = false;
    let removalSuccessCountFinal = 0;

      // 2.a Agregar nuevos
      const addedItemRecords = [];
      let addHardFailure = false;
      for (const it of toAdd) {
        try {
          const created = await apiClient.post(`/packages/${savedPackage.id}/items`, { item_id: it.item_id, item_type: it.item_type });
          addedItemRecords.push(created);
        } catch (e) {
          if (e?.status === 409) {
            // Duplicado u otro conflicto de integridad: continuar, no considerarlo hard failure
            duplicateAddCount++;
            toast({ title: 'Ítem ya estaba en el paquete', description: e.message || 'Conflicto al agregar ítem', variant: 'default' });
          } else {
            addHardFailure = true;
            toast({ title: 'Error agregando ítem', description: e.message, variant: 'destructive' });
          }
        }
      }

      // Si hubo fallo fuerte al agregar, no eliminar nada para no dejar el paquete vacío
      if (!addHardFailure) {
        // 2.b Eliminar los que ya no deben estar
        let removalSuccessCount = 0;
        for (const it of toRemove) {
          try { await apiClient.delete(`/packages/items/${it.id}`); }
          catch (e) {
            // Si no se encuentra, ignoramos; otros errores informar pero continuar
            if (e?.status !== 404) {
              toast({ title: 'Error eliminando ítem', description: e.message, variant: 'destructive' });
            }
          }
          removalSuccessCount++;
        }

        // 2.c Reordenar según el orden de UI (si la tabla soporta position)
        try {
          // Necesitamos los IDs actuales (keep + recién agregados) en el orden deseado
          const refetch = await apiClient.get(`/packages/${savedPackage.id}/items`);
          const byKey = new Map(refetch.map(it => [keyOf(it), it]));
          const desiredOrderIds = targetItems
            .map(it => byKey.get(keyOf(it))?.id)
            .filter(Boolean);
          if (desiredOrderIds.length === targetItems.length && desiredOrderIds.length > 0) {
            try {
              reorderAttempted = true;
              await apiClient.patch(`/packages/${savedPackage.id}/items/reorder`, { itemIds: desiredOrderIds });
              // Resumen toast más abajo
              reorderOk = true;
            } catch (innerReorderErr) {
              console.warn('Reordenamiento falló (inner):', innerReorderErr);
              reorderOk = false;
            }
          }
        } catch (reorderErr) {
          // El reordenamiento es best-effort: avisar pero no fallar toda la operación
          console.warn('Reordenamiento falló:', reorderErr);
          reorderAttempted = true;
          reorderOk = false;
        }
        // Guardar métricas en scope superior para el resumen
        removalSuccessCountFinal = typeof removalSuccessCount === 'number' ? removalSuccessCount : 0;
      } else {
        removalSuccessCountFinal = 0;
        reorderAttempted = false;
        reorderOk = false;
      }

      const priceNum = parseFloat(particularPrice);
      if (!isNaN(priceNum) && particularReferrer) {
        const priceList = { ...(particularReferrer.listaprecios || { studies: [], packages: [] }) };
        if (!Array.isArray(priceList.packages)) priceList.packages = [];
        const existingPriceIndex = priceList.packages.findIndex(p => p.itemId === savedPackage.id);
        if (existingPriceIndex > -1) priceList.packages[existingPriceIndex].price = priceNum; else priceList.packages.push({ itemId: savedPackage.id, price: priceNum, itemType: 'package' });
        await apiClient.put(`/referrers/${particularReferrer.id}`, { listaprecios: priceList });
      }

      await loadData();
      setIsFormOpen(false);
      setCurrentPackage(initialPackageForm);

      // 3) Resumen final (aunque haya toasts previas):
      try {
        toast({
          title: 'Resumen de cambios',
          description: `Agregados: ${addedItemRecords.length} | Ya existían: ${keptCount} | Eliminados: ${removalSuccessCountFinal} | Duplicados ignorados: ${duplicateAddCount} | Reordenamiento: ${!reorderAttempted ? 'No aplicó' : (reorderOk ? 'OK' : 'Falló')}`,
          variant: 'default'
        });
      } catch (resumeErr) {
        console.warn('No se pudo mostrar toast resumen:', resumeErr);
      }

    } catch(error) {
      // Mejorar mensajes de validación Zod desde backend
      if (error?.code === 'VALIDATION_ERROR' && error?.details?.details) {
        try {
          const issues = error.details.details;
          const msg = issues.map(i => `${i.path?.join('.') || 'campo'}: ${i.message}`).join(' | ');
          toast({ title: 'Validación fallida', description: msg, variant: 'destructive' });
        } catch {
          toast({ title: 'Validación fallida', description: error.message, variant: 'destructive' });
        }
      } else {
        toast({ title: "Error al guardar el paquete", description: error.message, variant: "destructive" });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (pkg) => {
    const priceForParticular = getParticularPrice(pkg.id);
    setCurrentPackage({
      ...pkg,
      // Normalize backend 'analysis' to UI 'study' so checkboxes pre-check
      items: (pkg.items || []).map(it => it.item_type === 'analysis' ? { ...it, item_type: 'study' } : it),
      particularPrice: priceForParticular === 'N/A' ? '' : priceForParticular
    });
    setIsFormOpen(true);
  };

  const handleDelete = async () => {
    if (!packageToDelete) return;
    setIsSubmitting(true);
    try {
      await apiClient.delete(`/packages/${packageToDelete.id}`);
      if (particularReferrer) {
        const priceList = { ...(particularReferrer.listaprecios || {}) };
        if (Array.isArray(priceList.packages)) {
          priceList.packages = priceList.packages.filter(p => p.itemId !== packageToDelete.id);
          try { await apiClient.put(`/referrers/${particularReferrer.id}`, { listaprecios: priceList }); } catch(e){ console.error('Error actualizando precios Particular:', e); }
        }
      }
  await logAuditEvent('PaqueteEliminado', { packageId: packageToDelete.id, packageName: packageToDelete.name });
      toast({ title: '¡Paquete Eliminado!', description: 'El paquete y sus precios asociados han sido eliminados.', variant: 'destructive' });
      await loadData();

    } catch (error) {
        toast({ title: "Error al eliminar", description: error.message, variant: "destructive" });
    } finally {
        setPackageToDelete(null);
        setIsDeleteDialogOpen(false);
        setIsSubmitting(false);
    }
  };

  const openDeleteDialog = (pkg) => {
    setPackageToDelete(pkg);
    setIsDeleteDialogOpen(true);
  };

  const getItemNameByIdAndType = useCallback((itemId, itemType) => {
    const normalizedType = itemType === 'analysis' ? 'study' : itemType;
    if (normalizedType === 'study') {
      const study = availableStudies.find(s => s.id === itemId);
      return study ? study.name : 'Estudio desconocido';
    }
    if (normalizedType === 'package') {
      const pkg = packages.find(p => p.id === itemId);
      return pkg ? pkg.name : 'Paquete desconocido';
    }
    return 'Item desconocido';
  }, [availableStudies, packages]);

  const filteredPackages = packages.filter(pkg =>
    pkg?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <PackageHelpDialog open={isHelpDialogOpen} onOpenChange={setIsHelpDialogOpen} />
      <Card className="shadow-xl glass-card flex flex-col h-[calc(100vh-100px)]">
        <PackagesHeader
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          onNewPackageClick={() => { setCurrentPackage(initialPackageForm); setIsFormOpen(true); }}
          onHelpClick={() => setIsHelpDialogOpen(true)}
          isSubmitting={isSubmitting}
        />
        <CardContent className="flex-grow p-2 md:p-6 pt-0">
          {isLoading ? (
            <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-sky-600" /></div>
          ) : (
            <ScrollArea className="h-[calc(100vh-250px)]">
              {isMobile ? (
                 <PackagesCardView
                    packages={filteredPackages}
                    getParticularPrice={getParticularPrice}
                    getItemNameByIdAndType={getItemNameByIdAndType}
                    handleEdit={handleEdit}
                    openDeleteConfirm={openDeleteDialog}
                    isSubmitting={isSubmitting}
                  />
              ) : (
                <div className="overflow-x-auto">
                   <PackagesTable
                    filteredPackages={filteredPackages}
                    getParticularPrice={getParticularPrice}
                    getItemNameByIdAndType={getItemNameByIdAndType}
                    handleEdit={handleEdit}
                    openDeleteConfirmDialog={openDeleteDialog}
                    isSubmitting={isSubmitting}
                  />
                </div>
              )}
            </ScrollArea>
          )}
        </CardContent>
        {!isLoading && packages.length > 0 && (
          <CardFooter className="text-sm text-muted-foreground p-4 md:p-6 pt-0">
            Mostrando {filteredPackages.length} de {packages.length} paquetes.
          </CardFooter>
        )}
      </Card>

      <PackageFormDialog
        isOpen={isFormOpen}
        onOpenChange={(isOpen) => { setIsFormOpen(isOpen); if (!isOpen) setCurrentPackage(initialPackageForm); }}
        currentPackage={currentPackage}
        onSubmit={handleSubmit}
        availableStudies={availableStudies}
        availablePackagesForSelection={availablePackagesForSelection}
        initialPackageForm={initialPackageForm}
        isSubmitting={isSubmitting}
      />
      
      <DeletePackageDialog
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        packageToDelete={packageToDelete}
        onConfirmDelete={handleDelete}
        isSubmitting={isSubmitting}
      />

    </motion.div>
  );
};

export default Packages;