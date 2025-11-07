import React, { useState, useEffect, useCallback, useRef } from 'react';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
    import { Button } from '@/components/ui/button';
    import { Label } from '@/components/ui/label';
  // removed legacy Select
  // Supabase removed – using apiClient
  import apiClient from '@/lib/apiClient';
    import { useToast } from "@/components/ui/use-toast";
    import { Loader2, Printer } from 'lucide-react';
    import TemplatePreview from './TemplatePreview';
    import SearchableSelect from '@/components/ui/SearchableSelect';
    import { useSettings } from '@/contexts/SettingsContext';
    import { useReactToPrint } from 'react-to-print';
    import PrintableReport from './PrintableReport';

    const TemplatePreviewDialog = ({ isOpen, onOpenChange, template }) => {
      const { toast } = useToast();
      const { settings } = useSettings();
      const [patients, setPatients] = useState([]);
      const [workOrders, setWorkOrders] = useState([]);
      const [selectedPatientId, setSelectedPatientId] = useState(null);
      const [selectedWorkOrderId, setSelectedWorkOrderId] = useState(null);
      const [patient, setPatient] = useState(null);
      const [workOrder, setWorkOrder] = useState(null);
      const [isLoading, setIsLoading] = useState(false);
      const [isFetchingData, setIsFetchingData] = useState(false);

      const componentToPrintRef = useRef();
      const handlePrint = useReactToPrint({
        content: () => componentToPrintRef.current,
      });

      const fetchPatients = useCallback(async () => {
        setIsFetchingData(true);
        try {
          const data = await apiClient.get('/patients');
          setPatients((data || []).map(p => ({ value: p.id, label: p.full_name })));
        } catch(e) {
          toast({ title: 'Error', description: 'No se pudieron cargar los pacientes.', variant: 'destructive' });
        } finally {
          setIsFetchingData(false);
        }
      }, [toast]);

      const fetchWorkOrders = useCallback(async (patientId) => {
        if (!patientId) { setWorkOrders([]); return; }
        setIsFetchingData(true);
        try {
          // Basic fetch all & filter client-side until backend filter endpoint is added
          const data = await apiClient.get('/work-orders');
          setWorkOrders((data || []).filter(w=>w.patient_id === patientId).map(wo => ({ value: wo.id, label: wo.folio })));
        } catch(e) {
          toast({ title: 'Error', description: 'No se pudieron cargar las órdenes de trabajo.', variant: 'destructive' });
        } finally { setIsFetchingData(false); }
      }, [toast]);

      useEffect(() => {
        if (isOpen) {
          fetchPatients();
        }
      }, [isOpen, fetchPatients]);

      useEffect(() => {
        if (selectedPatientId) {
          fetchWorkOrders(selectedPatientId);
        } else {
          setWorkOrders([]);
          setSelectedWorkOrderId(null);
        }
      }, [selectedPatientId, fetchWorkOrders]);

      const handlePreview = async () => {
        setIsLoading(true);
        setPatient(null);
        setWorkOrder(null);

        let tempPatient = null;
        let tempWorkOrder = null;

        try {
          if (selectedPatientId) {
            tempPatient = await apiClient.get(`/patients/${selectedPatientId}`);
          }
        } catch(e){ toast({ title: 'Error', description: 'No se pudo cargar el paciente.', variant: 'destructive' }); }
        try {
          if (selectedWorkOrderId) {
            tempWorkOrder = await apiClient.get(`/work-orders/${selectedWorkOrderId}`);
          }
        } catch(e){ toast({ title: 'Error', description: 'No se pudo cargar la orden de trabajo.', variant: 'destructive' }); }

        setPatient(tempPatient);
        setWorkOrder(tempWorkOrder);
        setIsLoading(false);
      };

      const handlePatientChange = (value) => {
        setSelectedPatientId(value);
        setSelectedWorkOrderId(null); // Reset work order when patient changes
        setPatient(null);
        setWorkOrder(null);
      };

      return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
          <DialogContent className="sm:max-w-[600px] md:max-w-[800px] lg:max-w-[1000px]">
            <DialogHeader>
              <DialogTitle>Previsualizar Plantilla: {template.name}</DialogTitle>
              <DialogDescription>
                Selecciona los filtros para generar una vista previa del reporte con datos reales.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                  <Label htmlFor="patient">Paciente</Label>
                  <SearchableSelect
                    options={patients}
                    value={selectedPatientId}
                    onValueChange={handlePatientChange}
                    placeholder="Buscar paciente..."
                    disabled={isFetchingData}
                  />
                </div>
                <div>
                  <Label htmlFor="workOrder">Orden de Trabajo</Label>
                  <SearchableSelect
                    options={workOrders}
                    value={selectedWorkOrderId || ''}
                    onValueChange={setSelectedWorkOrderId}
                    placeholder="Seleccionar orden..."
                    searchPlaceholder="Buscar orden..."
                    notFoundMessage="Sin órdenes"
                    disabled={!selectedPatientId || isFetchingData}
                  />
                </div>
                <Button onClick={handlePreview} disabled={!selectedPatientId || isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Generar Vista Previa"}
                </Button>
              </div>
              <div className="mt-4 border-t pt-4">
                <h3 className="text-lg font-semibold mb-2">Vista Previa</h3>
                <div className="border rounded-md p-4 h-[50vh] overflow-auto bg-slate-50 dark:bg-slate-900">
                  {isLoading ? (
                      <div className="flex items-center justify-center h-full text-slate-500">
                        <Loader2 className="h-6 w-6 animate-spin mr-2"/> Cargando datos...
                      </div>
                  ) : (patient || workOrder) ? (
                    <TemplatePreview template={template} patient={patient} workOrder={workOrder} labSettings={settings} />
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-500">
                      Selecciona filtros y genera una vista previa para ver el resultado.
                    </div>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <div style={{ display: 'none' }}>
                <PrintableReport ref={componentToPrintRef} template={template} patient={patient} workOrder={workOrder} labSettings={settings} />
              </div>
              <Button variant="outline" onClick={handlePrint} disabled={!patient && !workOrder}>
                <Printer className="mr-2 h-4 w-4" />
                Imprimir Reporte
              </Button>
              <DialogClose asChild><Button variant="outline">Cerrar</Button></DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );
    };

    export default TemplatePreviewDialog;