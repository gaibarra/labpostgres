import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { useToast } from "@/components/ui/use-toast";
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
// Migrated off Supabase: now uses REST apiClient
import { apiClient } from '@/lib/apiClient';
import { logAuditEvent } from '@/lib/auditUtils';
import { useAuth } from '@/contexts/AuthContext';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { ScrollArea } from '@/components/ui/scroll-area';

import ReferrersHeader from './referrers/ReferrersHeader';
import ReferrersTable from './referrers/ReferrersTable';
import ReferrersCardView from './referrers/ReferrersCardView';
import ReferrerFormDialog from './referrers/ReferrerFormDialog';
import DeleteReferrerDialog from './referrers/DeleteReferrerDialog';
import ReferrerPriceListPDFModal from './referrers/ReferrerPriceListPDFModal';
import ReferrerHelpDialog from './referrers/ReferrerHelpDialog';

const ensurePriceListStructure = (listaprecios) => {
  const defaultStructure = { studies: [], packages: [] };
  if (!listaprecios || typeof listaprecios !== 'object' || Array.isArray(listaprecios)) {
    return defaultStructure;
  }
  return {
    studies: Array.isArray(listaprecios.studies) ? listaprecios.studies : [],
    packages: Array.isArray(listaprecios.packages) ? listaprecios.packages : [],
  };
};

const Referrers = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const navigate = useNavigate();

  const [referrers, setReferrers] = useState([]);
  const [studies, setStudies] = useState([]);
  const [packagesData, setPackagesData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentReferrer, setCurrentReferrer] = useState(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [referrerToDelete, setReferrerToDelete] = useState(null);
  const [isPriceListPDFModalOpen, setIsPriceListPDFModalOpen] = useState(false);
  const [selectedReferrerForPDF, setSelectedReferrerForPDF] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [particularReferrer, setParticularReferrer] = useState(null);
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
  const refResp = await apiClient.get('/referrers?limit=5000');
      const referrersData = (refResp?.data || []).map(r => ({ ...r, listaprecios: ensurePriceListStructure(r.listaprecios) }));
      setReferrers(referrersData);
      setParticularReferrer(referrersData.find(r => r.name === 'Particular') || null);

  const studiesResp = await apiClient.get('/analysis?limit=5000');
      setStudies((studiesResp?.data || []).map(s => ({ id: s.id, name: s.name, clave: s.clave })));

  const packagesResp = await apiClient.get('/packages?limit=5000');
      setPackagesData((packagesResp?.data || []).map(p => ({ id: p.id, name: p.name })));

    } catch (error) {
      toast({ title: 'Error al cargar datos', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if(user) {
        fetchData();
    }
  }, [fetchData, user]);

  const handleSave = async (referrerData) => {
    setIsSubmitting(true);
    const { id, ...dataToUpsert } = referrerData;
    dataToUpsert.listaprecios = ensurePriceListStructure(dataToUpsert.listaprecios);

    try {
      if (id) {
        await apiClient.put(`/referrers/${id}`, dataToUpsert);
        await logAuditEvent('ReferenteActualizado', { referrerId: id, name: dataToUpsert.name });
        toast({ title: '¡Referente Actualizado!', description: 'Los datos se actualizaron con éxito.' });
      } else {
        const created = await apiClient.post('/referrers', dataToUpsert);
        await logAuditEvent('ReferenteCreado', { referrerId: created.id, name: created.name });
        toast({ title: '¡Referente Registrado!', description: 'El nuevo referente se guardó con éxito.' });
      }
      await fetchData();
      setIsFormOpen(false);
      setCurrentReferrer(null);
    } catch (error) {
      toast({ title: 'Error al guardar', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (referrer) => {
    setCurrentReferrer({ ...referrer, listaprecios: ensurePriceListStructure(referrer.listaprecios) });
    setIsFormOpen(true);
  };

  const openDeleteDialog = (referrer) => {
    setReferrerToDelete(referrer);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!referrerToDelete) return;
    setIsSubmitting(true);
    try {
      await apiClient.delete(`/referrers/${referrerToDelete.id}`);
      await logAuditEvent('ReferenteEliminado', { referrerId: referrerToDelete.id, name: referrerToDelete.name });
      toast({ title: '¡Referente Eliminado!', description: 'El referente ha sido eliminado.', variant: 'destructive' });
      await fetchData();
    } catch (error) {
      // Mapear errores del backend con mensajes claros
      let msg = 'Error desconocido';
      if (error?.status === 409 || error?.code === 'REFERRER_IN_USE') {
        msg = 'No se puede eliminar: el referente está asociado a órdenes u otros registros. Desvincula esas referencias y vuelve a intentar.';
      } else if ((error?.status === 400 && error?.code === 'REFERRER_PROTECTED') || (referrerToDelete?.name || '').toLowerCase() === 'particular') {
        msg = "El referente 'Particular' no puede eliminarse.";
      } else if (error?.status === 404 || error?.code === 'REFERRER_NOT_FOUND') {
        msg = 'El referente no existe o ya fue eliminado.';
      } else if (error?.code === '23503') {
        // Compatibilidad con manejos anteriores basados en códigos de FK de Postgres
        msg = 'No se puede eliminar, tiene órdenes asociadas.';
      } else if (error?.message) {
        msg = error.message;
      }
      toast({ title: 'No se pudo eliminar', description: msg, variant: 'destructive' });
    } finally {
      setIsDeleteDialogOpen(false);
      setReferrerToDelete(null);
      setIsSubmitting(false);
    }
  };
  
  const handleUpdateReferrerPrices = async (referrerId, newPriceList) => {
    const validatedPriceList = ensurePriceListStructure(newPriceList);
    try {
      await apiClient.put(`/referrers/${referrerId}`, { listaprecios: validatedPriceList });
      await logAuditEvent('ListaPreciosActualizada', { referrerId });
      await fetchData();
      return true;
    } catch (error) {
      toast({ title: 'Error', description: `No se pudo actualizar la lista de precios: ${error.message}`, variant: 'destructive' });
      return false;
    }
  };

  const filteredReferrers = referrers.filter(referrer => 
    (referrer.name && referrer.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (referrer.entity_type && referrer.entity_type.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (referrer.specialty && referrer.specialty.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (referrer.email && referrer.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleCreateQuote = (referrerId) => {
    navigate(`/quotes?referrerId=${referrerId}`);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <ReferrerHelpDialog open={isHelpDialogOpen} onOpenChange={setIsHelpDialogOpen} />
      <Card className="shadow-xl glass-card flex flex-col h-[calc(100vh-100px)]">
        <ReferrersHeader
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          onNewReferrerClick={() => { setCurrentReferrer(null); setIsFormOpen(true); }}
          onHelpClick={() => setIsHelpDialogOpen(true)}
          isSubmitting={isSubmitting}
        />
        <CardContent className="flex-grow p-2 md:p-6 pt-0">
          {isLoading ? (
            <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-sky-600" /></div>
          ) : (
            <ScrollArea className="h-[calc(100vh-250px)]">
              {isMobile ? (
                <ReferrersCardView
                  referrers={filteredReferrers}
                  handleEdit={handleEdit}
                  openDeleteConfirm={openDeleteDialog}
                  openPriceListPDFModal={(referrer) => { setSelectedReferrerForPDF(referrer); setIsPriceListPDFModalOpen(true); }}
                  studies={studies}
                  packagesData={packagesData}
                  onUpdateReferrerPrices={handleUpdateReferrerPrices}
                  particularReferrer={particularReferrer}
                  onCreateQuote={handleCreateQuote}
                  isSubmitting={isSubmitting}
                />
              ) : (
                <div className="overflow-x-auto">
                  <ReferrersTable
                    referrers={filteredReferrers}
                    handleEdit={handleEdit}
                    openDeleteConfirm={openDeleteDialog}
                    openPriceListPDFModal={(referrer) => { setSelectedReferrerForPDF(referrer); setIsPriceListPDFModalOpen(true); }}
                    studies={studies}
                    packagesData={packagesData}
                    onUpdateReferrerPrices={handleUpdateReferrerPrices}
                    particularReferrer={particularReferrer}
                    onCreateQuote={handleCreateQuote}
                    isSubmitting={isSubmitting}
                  />
                </div>
              )}
            </ScrollArea>
          )}
        </CardContent>
        {!isLoading && referrers.length > 0 && (
          <CardFooter className="text-sm text-muted-foreground p-4 md:p-6 pt-0">
            Mostrando {filteredReferrers.length} de {referrers.length} referentes.
          </CardFooter>
        )}
      </Card>

      <ReferrerFormDialog
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
        referrer={currentReferrer}
        onSave={handleSave}
        isSubmitting={isSubmitting}
      />

      <DeleteReferrerDialog
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        referrerToDelete={referrerToDelete}
        onConfirmDelete={confirmDelete}
        isSubmitting={isSubmitting}
      />

      {selectedReferrerForPDF && (
        <ReferrerPriceListPDFModal
          isOpen={isPriceListPDFModalOpen}
          onOpenChange={setIsPriceListPDFModalOpen}
          referrer={selectedReferrerForPDF}
          studies={studies}
          packagesData={packagesData}
        />
      )}
    </motion.div>
  );
};

export default Referrers;