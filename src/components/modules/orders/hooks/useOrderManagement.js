import { useState, useEffect, useCallback, useRef } from 'react';
    import { useToast } from "@/components/ui/use-toast";
    import { format, differenceInYears, differenceInMonths, differenceInDays, parseISO } from 'date-fns';
    import { logAuditEvent } from '@/lib/auditUtils';
    import apiClient from '@/lib/apiClient';
    import { useAuth } from '@/contexts/AuthContext';
    import { toISOStringWithTimeZone } from '@/lib/dateUtils';

  const ORDERS_PAGE_SIZE = 25;
  const PATIENT_SELECTOR_PAGE = 500;

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

        const buildSnapshotPatient = (snapshot) => {
          if (!snapshot || typeof snapshot !== 'object') return null;
          const normalized = {
            ...snapshot,
            phone_number: snapshot.phone_number || snapshot.phone || null,
            full_name: snapshot.full_name || snapshot.fullName || [snapshot.first_name, snapshot.last_name].filter(Boolean).join(' ').trim()
          };
          normalized.age = calculateAge(snapshot.date_of_birth || snapshot.dateOfBirth || null);
          return normalized;
        };

        export const useOrderManagement = () => {
          const { toast } = useToast();
          const { user } = useAuth();
          const [orders, setOrders] = useState([]);
          const [ordersMeta, setOrdersMeta] = useState({ page: 1, pageSize: ORDERS_PAGE_SIZE, total: 0, totalPages: 1, hasMore: false, search: '' });
          const [patients, setPatients] = useState([]);
          const [referrers, setReferrers] = useState([]);
          const [studies, setStudies] = useState([]);
          const [packages, setPackages] = useState([]);
          const [currentOrder, setCurrentOrder] = useState(initialOrderForm);
          const [isDirectoryLoading, setIsDirectoryLoading] = useState(true);
          const [isOrdersLoading, setIsOrdersLoading] = useState(true);

          const ordersSearchRef = useRef('');
          const latestPatientsRef = useRef([]);

          const loadDirectories = useCallback(async () => {
            setIsDirectoryLoading(true);
            try {
              const patientParams = new URLSearchParams({ page: '1', pageSize: String(PATIENT_SELECTOR_PAGE) });
              const [patientsResp, referrersResp, studiesResp, packagesResp] = await Promise.all([
                apiClient.get(`/patients?${patientParams.toString()}`),
                apiClient.get('/referrers?limit=200'),
                apiClient.get('/analysis/detailed?limit=5000'),
                apiClient.get('/packages/detailed?limit=5000')
              ]);
              const rawPatients = Array.isArray(patientsResp?.data) ? patientsResp.data : (Array.isArray(patientsResp) ? patientsResp : []);
              const safePatients = rawPatients.map(p => ({
                ...p,
                age: calculateAge(p.date_of_birth)
              }));
              latestPatientsRef.current = safePatients;
              setPatients(safePatients);
              setReferrers(referrersResp?.data ? referrersResp.data : referrersResp || []);
              const studiesData = studiesResp?.data ? studiesResp.data : studiesResp;
              const formattedStudies = (studiesData || []).map(s => ({
                ...s,
                parameters: (s.parameters || []).map(p => ({ ...p, reference_ranges: p.reference_ranges || [] }))
              }));
              setStudies(formattedStudies);
              const packagesData = packagesResp?.data ? packagesResp.data : packagesResp;
              setPackages(packagesData || []);
              return safePatients;
            } catch (error) {
              if (error?.status === 429) {
                toast({ title: 'Demasiadas peticiones', description: 'Has alcanzado el límite de solicitudes. Espera unos segundos o recarga la página.', variant: 'destructive' });
              } else {
                toast({ title: 'Error al cargar catálogos para órdenes', description: error.message, variant: 'destructive' });
              }
              return latestPatientsRef.current;
            } finally {
              setIsDirectoryLoading(false);
            }
          }, [toast]);

          const loadOrders = useCallback(async ({ page = 1, search = ordersSearchRef.current, patientDirectory } = {}) => {
            setIsOrdersLoading(true);
            try {
              ordersSearchRef.current = search || '';
              const params = new URLSearchParams({ page: String(page), pageSize: String(ORDERS_PAGE_SIZE) });
              if (ordersSearchRef.current) params.set('search', ordersSearchRef.current);
              const resp = await apiClient.get(`/work-orders?${params.toString()}`);
              const payload = Array.isArray(resp?.data) ? resp.data : (Array.isArray(resp) ? resp : []);
              const meta = resp?.meta || {};
              const directorySource = Array.isArray(patientDirectory) ? patientDirectory : (latestPatientsRef.current.length ? latestPatientsRef.current : patients);
              const patientMap = new Map(directorySource.map(p => [p.id, p]));
              const populatedOrders = payload.map(order => {
                const patientFromDir = order.patient_id ? patientMap.get(order.patient_id) : null;
                const snapshotPatient = buildSnapshotPatient(order.patient_snapshot);
                let patient = patientFromDir ? { ...patientFromDir } : null;
                if (!patient && snapshotPatient) patient = snapshotPatient;
                if (patient && !patient.age) {
                  patient.age = calculateAge(patient.date_of_birth || patient.dateOfBirth || null);
                }
                const base = {
                  ...initialOrderForm,
                  ...order,
                };
                if (order.results !== undefined) base.results = order.results;
                if (order.validation_notes !== undefined) base.validation_notes = order.validation_notes;
                base.order_date = order.order_date ? new Date(order.order_date) : new Date();
                base.patient = patient || null;
                base.patient_name = order.patient_name || patient?.full_name || patient?.name || 'Paciente no encontrado';
                return base;
              });
              setOrders(populatedOrders);
              const total = meta.total ?? populatedOrders.length;
              const pageSize = meta.pageSize ?? ORDERS_PAGE_SIZE;
              const totalPages = meta.totalPages ?? Math.max(1, Math.ceil(total / pageSize));
              setOrdersMeta({
                page: meta.page ?? page,
                pageSize,
                total,
                totalPages,
                hasMore: meta.hasMore ?? (meta.page ?? page) < totalPages,
                search: ordersSearchRef.current
              });
            } catch (error) {
              toast({ title: 'Error al cargar órdenes', description: error.message, variant: 'destructive' });
            } finally {
              setIsOrdersLoading(false);
            }
          }, [toast, patients]);

          const loadData = useCallback(async () => {
            const latest = await loadDirectories();
            await loadOrders({ page: 1, search: ordersSearchRef.current, patientDirectory: latest });
          }, [loadDirectories, loadOrders]);

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

      const lastSaveRef = useRef({ orderId: null, hash: null, ts: 0 });
      const pendingTimeoutRef = useRef(null);

  const previewOpenRef = useRef(false);

  const handleSaveResults = useCallback(async (orderId, rawResults, status, notes, openFinalReportModalCallback) => {
        // Debounce: limpiar intento previo si existe
        if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
        pendingTimeoutRef.current = setTimeout(async () => {
        try {
          // 1. Normalizar keys de estudios como strings y deep clone para evitar mutaciones posteriores.
          const results = Object.fromEntries(Object.entries(rawResults || {}).map(([k, arr]) => [String(k), Array.isArray(arr) ? arr.map(e => ({ ...e, parametroId: e.parametroId })) : arr]));

          // 2. Hash rápido para diagnosticar cambios (longitud JSON + número parámetros totales)
          const buildResultsHash = (r) => {
            try {
              const keys = Object.keys(r || {});
              const totalParams = keys.reduce((acc, k) => acc + (Array.isArray(r[k]) ? r[k].length : 0), 0);
              const size = JSON.stringify(r || {}).length;
              return `${keys.length}k-${totalParams}p-${size}b`;
            } catch { return 'hash_err'; }
          };

          const optimisticOrderPatch = { id: orderId, results, status, validation_notes: notes };
          setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...optimisticOrderPatch } : o));

          const reqHash = buildResultsHash(results);
          // Evitar PUT si hash y estado igual al último (previene bucles dobles de validación / guardar)
          if (lastSaveRef.current.orderId === orderId && lastSaveRef.current.hash === reqHash && lastSaveRef.current.status === status) {
            console.info('[RESULTS][SKIP_DUPLICATE]', orderId, reqHash, status);
            return;
          }
          lastSaveRef.current = { orderId, hash: reqHash, status, ts: Date.now() };

          console.groupCollapsed('%c[RESULTS][REQUEST]','color:#16a34a;font-weight:bold;', orderId);
          console.info('status=', status, 'notes.len=', (notes||'').length, 'hash=', reqHash);
          Object.entries(results||{}).forEach(([sid, arr]) => console.info(' study', sid, 'params=', Array.isArray(arr)?arr.map(r=>r.parametroId):'N/A'));
          console.groupEnd();

          // 3. Enviar PUT
          const updatedOrder = await apiClient.put(`/work-orders/${orderId}`, { results, status, validation_notes: notes });

            console.groupCollapsed('%c[RESULTS][PUT-RESPONSE]','color:#2563eb;font-weight:bold;', orderId);
            if (updatedOrder) {
              console.info('fields=', Object.keys(updatedOrder));
              const respHash = buildResultsHash(updatedOrder.results || {});
              console.info('resp.hash=', respHash, 'resp.status=', updatedOrder.status);
            } else {
              console.warn('Respuesta vacía del PUT.');
            }
            console.groupEnd();

          // 4. Merge defensivo (si backend omitió results por tema de columnas dinámicas)
          const mergedUpdatedOrder = {
            ...updatedOrder,
            results: (updatedOrder && updatedOrder.results && Object.keys(updatedOrder.results || {}).length) ? updatedOrder.results : results,
            status: updatedOrder?.status || status,
            validation_notes: updatedOrder?.validation_notes ?? notes,
          };

          // 5. Refetch forzado para confirmar persistencia real antes de abrir modal
          let refetched = null;
          try {
            refetched = await apiClient.get(`/work-orders/${orderId}`);
            console.groupCollapsed('%c[RESULTS][REFETCH]','color:#9333ea;font-weight:bold;', orderId);
            console.info('refetch.status=', refetched?.status, 'hash=', buildResultsHash(refetched?.results || {}));
            if (refetched && refetched.results && typeof refetched.results === 'object') {
              const diffKeys = Object.keys(results).filter(k => !Object.prototype.hasOwnProperty.call(refetched.results, k));
              if (diffKeys.length) console.warn('refetch.missingKeys=', diffKeys);
            }
            console.groupEnd();
          } catch (e) {
            console.warn('[RESULTS][REFETCH_FAIL]', e.message);
          }

          const finalForModal = refetched ? {
            ...mergedUpdatedOrder,
            // Prefer refetched authoritative values si contienen resultados
            results: (refetched.results && Object.keys(refetched.results).length) ? refetched.results : mergedUpdatedOrder.results,
            status: refetched.status || mergedUpdatedOrder.status,
            validation_notes: refetched.validation_notes ?? mergedUpdatedOrder.validation_notes,
            // Preserve selected_items from local state if backend omits/filters them to avoid empty preview
            selected_items: Array.isArray(refetched.selected_items) && refetched.selected_items.length
              ? refetched.selected_items
              : (mergedUpdatedOrder.selected_items || [])
          } : mergedUpdatedOrder;

          console.groupCollapsed('%c[RESULTS][PREVIEW_OPEN]','color:#0ea5e9;font-weight:bold;', orderId);
          console.info('final.status=', finalForModal.status, 'hash=', buildResultsHash(finalForModal.results));
          console.groupEnd();

          // 6. Sincronizar listado (no esperamos a finalizar para no degradar UX)
          loadData();
          await logAuditEvent('ResultadosGuardados', { orderId: orderId, folio: finalForModal?.folio, status: finalForModal.status });

          if (openFinalReportModalCallback) {
            if (previewOpenRef.current) {
              console.info('[RESULTS][PREVIEW_SUPPRESSED_DUPLICATE]', orderId);
            } else {
              previewOpenRef.current = true;
              openFinalReportModalCallback(finalForModal);
              setTimeout(()=>{ previewOpenRef.current = false; }, 800); // ventana anti-doble apertura
              toast({ title: 'Resultados Validados', description: 'Previsualizando reporte final.' });
            }
          } else {
            toast({ title: 'Resultados Guardados', description: 'Los resultados y estado se actualizaron.' });
          }
        } catch (error) {
          toast({ title: 'Error al guardar resultados', description: error.message, variant: 'destructive' });
        }
        }, 200); // 200ms debounce
      }, [toast, loadData]);

          const getPatientName = useCallback((patientId) => patients.find(p => p.id === patientId)?.full_name || 'N/A', [patients]);
          const getReferrerName = useCallback((referrerId) => referrers.find(r => r.id === referrerId)?.name || 'N/A', [referrers]);

          const getStudiesAndParametersForOrder = useCallback((orderItems, allStudies, allPackages) => {
            const finalStudiesList = [];
            const addedStudiesMap = new Map();
            const studiesMap = new Map(allStudies.map(s => [s.id, s]));
            const packagesMap = new Map(allPackages.map(p => [p.id, p]));

            const stack = [...(orderItems || []).map(item => ({
              ...item,
              id: item.id || item.item_id,
              // Normaliza 'analysis' a 'study'
              type: (item.type || item.item_type) === 'analysis' ? 'study' : (item.type || item.item_type)
            }))];

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
              type: sub.item_type === 'analysis' ? 'study' : sub.item_type
            }));
                        stack.push(...subItems);
                    }
                }
            }
            return finalStudiesList;
          }, []);


          const isLoading = isDirectoryLoading || isOrdersLoading;

          return {
            orders,
            ordersMeta,
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
            loadData,
            loadOrders
          };
        };