import React, { useState, useEffect, useCallback, useRef } from 'react';
    import { useLocation, useNavigate } from 'react-router-dom';
    import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
  import { Button } from '@/components/ui/button';
    import { FileText } from 'lucide-react';
    import { AnimatePresence } from 'framer-motion';
    import OrdersHeader from '@/components/modules/orders/OrdersHeader';
    import OrdersTable from '@/components/modules/orders/OrdersTable';
    import { useOrderManagement } from '@/components/modules/orders/hooks/useOrderManagement';
      import { useOrderModals } from '@/components/modules/orders/hooks/useOrderModals.jsx';
    import OrderHelpDialog from '@/components/modules/orders/OrderHelpDialog';
  import { useDebounce } from 'use-debounce';

  const Orders = () => {
      const [searchTerm, setSearchTerm] = useState('');
      const [debouncedSearchTerm] = useDebounce(searchTerm, 400);
      const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);
      const location = useLocation();
      const navigate = useNavigate();
      const referrerRef = useRef(null);
      
      const {
        orders,
        ordersMeta,
        patients,
        referrers,
        studies,
        packages,
        initialOrderForm,
        isLoading,
        handleSubmitOrder,
        handleDeleteOrder,
        handleSaveResults,
        getStudiesAndParametersForOrder,
        loadData,
        loadOrders,
      } = useOrderManagement();

      const { modalState, openModal, modalComponent } = useOrderModals({
        studiesDetails: studies,
        packagesDetails: packages,
        patients,
        referrers,
        onSubmit: handleSubmitOrder,
        handleSaveResults,
        getStudiesAndParametersForOrder,
        loadData,
        referrerRef,
      });

      useEffect(() => {
        if ((ordersMeta?.search || '') === (debouncedSearchTerm || '')) return;
        loadOrders({ page: 1, search: debouncedSearchTerm });
      }, [debouncedSearchTerm, loadOrders, ordersMeta?.search]);

      const newPatientId = location.state?.newPatientId;

      useEffect(() => {
        if (!newPatientId || patients.length === 0) return;
        const orderWithNewPatient = { ...initialOrderForm, patient_id: newPatientId };
        openModal('form', orderWithNewPatient);
      }, [newPatientId, patients.length, initialOrderForm, openModal]);

      useEffect(() => {
        if (!newPatientId) return;
        navigate(location.pathname, { replace: true, state: {} });
      }, [newPatientId, navigate, location.pathname]);
      
      const handleEdit = useCallback((order) => {
        openModal('form', order);
      }, [openModal]);

      const handleNewOrder = useCallback(() => {
        openModal('form', initialOrderForm);
      }, [openModal, initialOrderForm]);

      const safeOrders = orders || [];
      // Obtener highlight de query param
      const params = new URLSearchParams(location.search);
      const highlightId = params.get('highlight');

      const currentPage = ordersMeta?.page || 1;
      const totalPages = ordersMeta?.totalPages || 1;
      const pageSize = ordersMeta?.pageSize || (safeOrders.length || 1);
      const totalOrders = ordersMeta?.total ?? safeOrders.length;
      const startIndex = totalOrders && safeOrders.length ? (currentPage - 1) * pageSize + 1 : 0;
      const endIndex = totalOrders && safeOrders.length ? startIndex + safeOrders.length - 1 : 0;
      const rangeDescription = !totalOrders
        ? 'Sin órdenes registradas'
        : safeOrders.length
          ? `Mostrando ${startIndex}-${endIndex} de ${totalOrders} órdenes`
          : 'Sin coincidencias para los filtros aplicados.';

      const handlePageChange = useCallback((nextPage) => {
        if (nextPage < 1 || nextPage > totalPages || nextPage === currentPage) return;
        loadOrders({ page: nextPage, search: debouncedSearchTerm });
      }, [currentPage, totalPages, loadOrders, debouncedSearchTerm]);

      return (
        <div className="space-y-6">
          <OrderHelpDialog open={isHelpDialogOpen} onOpenChange={setIsHelpDialogOpen} />
          <Card className="shadow-xl glass-card">
            <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between">
              <div className="flex items-center">
                <FileText className="h-8 w-8 mr-3 text-sky-600 dark:text-sky-400" />
                <CardTitle className="text-2xl font-bold text-sky-700 dark:text-sky-400">Gestión de Órdenes</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <OrdersHeader 
                searchTerm={searchTerm} 
                setSearchTerm={setSearchTerm} 
                onNewOrderClick={handleNewOrder}
                onHelpClick={() => setIsHelpDialogOpen(true)}
              />
              <div className="overflow-x-auto">
                <OrdersTable 
                  orders={safeOrders}
                  isLoading={isLoading}
                  onEdit={handleEdit}
                  onDelete={handleDeleteOrder}
                  onOpenModal={openModal}
                  highlightId={highlightId}
                />
              </div>
              <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p className="text-sm text-muted-foreground">{rangeDescription}</p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage <= 1 || isLoading}
                  >
                    Anterior
                  </Button>
                  <span className="text-sm font-medium">
                    Página {currentPage} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages || isLoading}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <AnimatePresence>
            {modalState.isOpen && modalComponent}
          </AnimatePresence>
        </div>
      );
    };

    export default Orders;