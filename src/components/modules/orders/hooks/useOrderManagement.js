import { useState, useEffect, useCallback, useRef } from 'react';
        import { useToast } from "@/components/ui/use-toast";
        import { format, differenceInYears, differenceInMonths, differenceInDays, parseISO } from 'date-fns';
        import { logAuditEvent } from '@/lib/auditUtils';
        import apiClient from '@/lib/apiClient';
        import { useAuth } from '@/contexts/AuthContext';
        import { toISOStringWithTimeZone } from '@/lib/dateUtils';

        const initialOrderForm = {
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
          results: {},
          validation_notes: '',
        };

        const calculateAge = (birthDate) => {
          if (!birthDate) return { ageYears: null, ageMonths: null, ageDays: null };
          
          const dob = parseISO(birthDate);
          
          if (isNaN(dob.getTime())) {
            console.error("Fecha de nacimiento inválida recibida:", birthDate);
            return { ageYears: null, ageMonths: null, ageDays: null };
          }

          const now = new Date();
          const ageYears = differenceInYears(now, dob);
          const ageMonths = differenceInMonths(now, dob) % 12;
          const ageDays = differenceInDays(now, dob) % 30; // Aproximación
          return { ageYears, ageMonths, ageDays };
        };

        export const useOrderManagement = () => {
          const { toast } = useToast();
          const { user } = useAuth();
          const [orders, setOrders] = useState([]);
          const [patients, setPatients] = useState([]);
          const [referrers, setReferrers] = useState([]);
          const [studies, setStudies] = useState([]);
          const [packages, setPackages] = useState([]);
          const [currentOrder, setCurrentOrder] = useState(initialOrderForm);
          const [isLoading, setIsLoading] = useState(true);

          const loadData = useCallback(async () => {
            setIsLoading(true);
            try {
              const [ordersData, patientsData, referrersResp, studiesResp, packagesResp] = await Promise.all([
                apiClient.get('/work-orders'),
                apiClient.get('/patients'),
                apiClient.get('/referrers?limit=200'),
                apiClient.get('/analysis/detailed?limit=500'),
                apiClient.get('/packages/detailed?limit=500')
              ]);

              const safePatients = (patientsData || []).map(p => ({
                ...p,
                age: calculateAge(p.date_of_birth)
              }));
              const patientsMap = new Map(safePatients.map(p => [p.id, p]));

              const populatedOrders = (ordersData || []).map(order => {
                const patient = patientsMap.get(order.patient_id);
                return {
                  ...initialOrderForm,
                  ...order,
                  order_date: order.order_date ? new Date(order.order_date) : new Date(),
                  patient_name: patient ? patient.full_name : 'Paciente no encontrado',
                  patient: patient || null
                };
              });

              setOrders(populatedOrders);
              setPatients(safePatients);
              setReferrers((referrersResp?.data) ? referrersResp.data : referrersResp || []);

              const studiesData = (studiesResp?.data) ? studiesResp.data : studiesResp;
              const formattedStudies = (studiesData || []).map(s => ({
                ...s,
                parameters: (s.parameters || []).map(p => ({ ...p, reference_ranges: p.reference_ranges || [] }))
              }));
              setStudies(formattedStudies);

              const packagesData = (packagesResp?.data) ? packagesResp.data : packagesResp;
              setPackages(packagesData || []);
            } catch (error) {
              if (error?.status === 429) {
                toast({ title: 'Demasiadas peticiones', description: 'Has alcanzado el límite de solicitudes. Espera unos segundos o recarga la página.', variant: 'destructive' });
              } else {
                toast({ title: 'Error al cargar datos de órdenes', description: error.message, variant: 'destructive' });
              }
            } finally {
              setIsLoading(false);
            }
          }, [toast]);

          // Evita doble llamada en StrictMode (montaje/desmontaje inmediato en DEV)
          const mountedOnceRef = useRef(false);
          useEffect(() => {
            if (!user) return;
            if (mountedOnceRef.current) return; // no volver a invocar en re-montajes de StrictMode
            mountedOnceRef.current = true;
            loadData();
          }, [loadData, user]);

          const generateOrderFolio = useCallback(async (date) => {
            const datePart = format(date, 'yyyy-MM-dd');
            try {
              const data = await apiClient.get(`/work-orders/next-folio?date=${encodeURIComponent(datePart)}`);
              return data?.folio || datePart.replace(/-/g,'') + '-001';
            } catch (e) {
              console.error('Error generando folio', e);
              return datePart.replace(/-/g,'') + '-001';
            }
          }, []);
          
          const handleSubmitOrder = useCallback(async (orderData, openWorkSheetModalCallback) => {
            let isNewOrder = !orderData.id;

            const dataForDb = {
              patient_id: orderData.patient_id || null,
              referring_entity_id: orderData.referring_entity_id || null,
              referring_doctor_id: orderData.referring_doctor_id || null,
              institution_reference: orderData.institution_reference || null,
              order_date: toISOStringWithTimeZone(orderData.order_date),
              selected_items: orderData.selected_items,
              status: orderData.status,
              subtotal: orderData.subtotal,
              total_price: orderData.total_price,
              anticipo: orderData.anticipo,
              descuento: orderData.descuento,
              notas: orderData.notas,
              results: orderData.results || {},
              validation_notes: orderData.validation_notes || ''
            };
            
            try {
              let savedOrder;
              if (isNewOrder) {
                dataForDb.folio = await generateOrderFolio(new Date(dataForDb.order_date));
                const data = await apiClient.post('/work-orders', dataForDb);
                savedOrder = data;
                await logAuditEvent('OrdenCreada', { orderId: savedOrder.id, folio: savedOrder.folio });
                toast({ title: "¡Orden Registrada!", description: `La orden ${savedOrder.folio} se guardó con éxito.` });
              } else {
                const data = await apiClient.put(`/work-orders/${orderData.id}`, dataForDb);
                savedOrder = data;
                await logAuditEvent('OrdenActualizada', { orderId: savedOrder.id, folio: savedOrder.folio });
                toast({ title: "¡Orden Actualizada!", description: `La orden ${savedOrder.folio} se actualizó con éxito.` });
              }
              
              await loadData();
              setCurrentOrder(initialOrderForm);

              if (isNewOrder && openWorkSheetModalCallback) {
                openWorkSheetModalCallback({ ...orderData, ...savedOrder });
              }
              return { ...orderData, ...savedOrder };

            } catch (error) {
              toast({ title: "Error al guardar la orden", description: error.message, variant: "destructive" });
              return null;
            }
          }, [toast, generateOrderFolio, loadData]);

          const handleEditOrder = useCallback((order) => {
            const referrer = referrers.find(r => r.id === order.referring_entity_id);
            setCurrentOrder({
              ...initialOrderForm,
              ...order,
              order_date: new Date(order.order_date),
              referring_doctor_id: referrer?.entity_type === 'Institución' ? order.referring_doctor_id : null,
              institution_reference: referrer?.entity_type === 'Institución' ? order.institution_reference : '',
            });
          }, [referrers]);

      const handleDeleteOrder = useCallback(async (orderToDelete) => {
            if (!orderToDelete) return;
            try {
        await apiClient.delete(`/work-orders/${orderToDelete.id}`);
        await logAuditEvent('OrdenEliminada', { orderId: orderToDelete.id, folio: orderToDelete.folio });
              toast({ title: "¡Orden Eliminada!", description: "La orden ha sido eliminada.", variant: "destructive" });
              await loadData();
            } catch (error) {
              toast({ title: "Error al eliminar la orden", description: error.message, variant: "destructive" });
            }
      }, [toast, loadData]);

      const handleSaveResults = useCallback(async (orderId, results, status, notes, openFinalReportModalCallback) => {
            try {
        const updatedOrder = await apiClient.put(`/work-orders/${orderId}`, { results, status, validation_notes: notes });
              await loadData();
        await logAuditEvent('ResultadosGuardados', { orderId: orderId, folio: updatedOrder?.folio, status: status });
              
              if (openFinalReportModalCallback && updatedOrder) {
                openFinalReportModalCallback(updatedOrder);
                toast({ title: "Resultados Validados", description: "Mostrando previsualización del reporte final." });
              } else {
                toast({ title: "Resultados Guardados", description: "Los resultados y el estado de la orden han sido actualizados." });
              }
            } catch (error) {
              toast({ title: "Error al guardar resultados", description: error.message, variant: "destructive" });
            }
      }, [toast, loadData]);

          const getPatientName = useCallback((patientId) => patients.find(p => p.id === patientId)?.full_name || 'N/A', [patients]);
          const getReferrerName = useCallback((referrerId) => referrers.find(r => r.id === referrerId)?.name || 'N/A', [referrers]);

          const getStudiesAndParametersForOrder = useCallback((orderItems, allStudies, allPackages) => {
            const finalStudiesList = [];
            const addedStudiesMap = new Map();
            const studiesMap = new Map(allStudies.map(s => [s.id, s]));
            const packagesMap = new Map(allPackages.map(p => [p.id, p]));

            const stack = [...(orderItems || []).map(item => ({...item, id: item.id || item.item_id, type: item.type || item.item_type}))];

            while (stack.length > 0) {
                const item = stack.pop();

                if (!item || !item.type || !item.id) continue;

                if (item.type === 'study') {
                    if (addedStudiesMap.has(item.id)) continue;
                    const studyDetail = studiesMap.get(item.id);
                    if (studyDetail) {
                        finalStudiesList.push(JSON.parse(JSON.stringify(studyDetail)));
                        addedStudiesMap.set(studyDetail.id, true);
                    }
                } else if (item.type === 'package') {
                    const packageDetail = packagesMap.get(item.id);
                    if (packageDetail && Array.isArray(packageDetail.items)) {
                        const subItems = packageDetail.items.map(sub => ({
                            id: sub.item_id,
                            type: sub.item_type
                        }));
                        stack.push(...subItems);
                    }
                }
            }
            return finalStudiesList;
          }, []);


          return {
            orders,
            patients,
            referrers,
            studies,
            packages,
            currentOrder,
            setCurrentOrder,
            initialOrderForm,
            handleSubmitOrder,
            handleEditOrder,
            handleDeleteOrder,
            handleSaveResults,
            getPatientName,
            getReferrerName,
            getStudiesAndParametersForOrder,
            isLoading,
            loadData
          };
        };