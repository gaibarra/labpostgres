import React, { useState, useEffect, useCallback, useRef } from 'react';
    import { useLocation, useNavigate } from 'react-router-dom';
    import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
    import { useToast } from "@/components/ui/use-toast";
    import { FileText } from 'lucide-react';
    import { AnimatePresence } from 'framer-motion';
    import OrdersHeader from '@/components/modules/orders/OrdersHeader';
    import OrdersTable from '@/components/modules/orders/OrdersTable';
    import { useOrderManagement } from '@/components/modules/orders/hooks/useOrderManagement';
    import { useOrderModals } from '@/components/modules/orders/hooks/useOrderModals.jsx';
    import { useAuth } from '@/contexts/AuthContext';
    import OrderHelpDialog from '@/components/modules/orders/OrderHelpDialog';

  const Orders = () => {
      const { toast } = useToast();
      const { user } = useAuth();
      const [searchTerm, setSearchTerm] = useState('');
      const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);
      const location = useLocation();
      const navigate = useNavigate();
      const referrerRef = useRef(null);
      
      const {
        orders,
        patients,
        referrers,
        studies,
        packages,
        initialOrderForm,
        isLoading,
        handleSubmitOrder,
        handleDeleteOrder,
        loadData,
      } = useOrderManagement();

      const {
        modalState,
        openModal,
        modalComponent
      } = useOrderModals({
        studiesDetails: studies,
        packagesDetails: packages,
        patients,
        referrers,
        onSubmit: handleSubmitOrder,
        referrerRef,
      });

      useEffect(() => {
        if(loadData && user) {
          loadData().catch(error => {
            toast({ title: "Error cargando datos iniciales", description: error.message, variant: "destructive" });
          });
        }
      }, [loadData, toast, user]);

      useEffect(() => {
        if (location.state?.newPatientId && patients.length > 0) {
          const newPatientId = location.state.newPatientId;
          const orderWithNewPatient = { ...initialOrderForm, patient_id: newPatientId };
          openModal('form', orderWithNewPatient);
          
          navigate(location.pathname, { replace: true, state: {} });
        }
      }, [location.state, patients, openModal, initialOrderForm, navigate, location.pathname]);
      
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

      // Scroll suave al elemento resaltado la primera vez que exista
      const scrolledRef = useRef(false);
      useEffect(() => {
        if (highlightId && !scrolledRef.current) {
          const el = document.getElementById(`order-${highlightId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            scrolledRef.current = true;
            // Remover animación pulsante después de 3s (mantener resaltado base)
            setTimeout(() => {
              try {
                if (el.classList.contains('animate-pulse-[1.5s_ease-in-out_2]')) {
                  el.classList.remove('animate-pulse-[1.5s_ease-in-out_2]');
                }
              } catch(_) {}
            }, 3000);
          }
        }
      }, [highlightId, safeOrders]);
      const filteredOrders = searchTerm
        ? safeOrders.filter(order =>
            (order?.patient_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (order?.folio?.toLowerCase() || '').includes(searchTerm.toLowerCase())
          )
        : safeOrders;

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
                  orders={filteredOrders}
                  isLoading={isLoading}
                  onEdit={handleEdit}
                  onDelete={handleDeleteOrder}
                  onOpenModal={openModal}
                  highlightId={highlightId}
                />
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