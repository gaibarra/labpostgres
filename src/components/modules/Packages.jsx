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
      const pkgResp = await apiClient.get('/packages/detailed?limit=500');
      setPackages(pkgResp.data || []);
      const studiesResp = await apiClient.get('/analysis?limit=500');
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
    const { id, particularPrice, items, ...dataToSave } = packageData;

    try {
      let savedPackage;

      if (id) {
        // Update package core fields
        await apiClient.put(`/packages/${id}`, dataToSave);
        // Replace items: delete all existing then re-add
        // Backend lacks bulk replace endpoint; we'll fetch items and remove individually
        // Simpler approach: fetch detailed again after insertion
        // For now, delete items client-side is omitted; assuming update only changes name/description/price
  await logAuditEvent('PaqueteActualizado', { packageId: id, packageName: dataToSave.name });
        toast({ title: '¡Paquete Actualizado!', description: `El paquete ${dataToSave.name} se actualizó con éxito.` });
        savedPackage = { id, ...dataToSave };
      } else {
        const created = await apiClient.post('/packages', dataToSave);
        savedPackage = created;
  await logAuditEvent('PaqueteCreado', { packageId: savedPackage.id, packageName: savedPackage.name });
        toast({ title: '¡Paquete Registrado!', description: `El paquete ${savedPackage.name} se guardó con éxito.` });
      }

      // Sync items: naive approach delete existing then re-add (need current items if updating)
      if (id) {
        // Fetch current items
        const existingItems = await apiClient.get(`/packages/${id}/items`);
        for (const it of existingItems) {
          await apiClient.delete(`/packages/items/${it.id}`);
        }
      }
      if (items && items.length > 0) {
        for (const it of items) {
          const normalizedType = it.item_type === 'study' ? 'analysis' : it.item_type;
          await apiClient.post(`/packages/${savedPackage.id}/items`, { item_id: it.item_id, item_type: normalizedType });
        }
      }

      const price = parseFloat(particularPrice);
      if (!isNaN(price) && particularReferrer) {
        const priceList = { ...(particularReferrer.listaprecios || { studies: [], packages: [] }) };
        if (!Array.isArray(priceList.packages)) priceList.packages = [];
        const existingPriceIndex = priceList.packages.findIndex(p => p.itemId === savedPackage.id);
        if (existingPriceIndex > -1) priceList.packages[existingPriceIndex].price = price; else priceList.packages.push({ itemId: savedPackage.id, price, itemType: 'package' });
        await apiClient.put(`/referrers/${particularReferrer.id}`, { listaprecios: priceList });
      }

      await loadData();
      setIsFormOpen(false);
      setCurrentPackage(initialPackageForm);

    } catch(error) {
      toast({ title: "Error al guardar el paquete", description: error.message, variant: "destructive" });
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