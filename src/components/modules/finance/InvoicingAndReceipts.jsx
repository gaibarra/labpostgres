import React, { useState, useEffect, useCallback, useRef } from 'react';
    import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
    import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
    import { motion } from 'framer-motion';
    import { FileText } from 'lucide-react';
    import { useToast } from "@/components/ui/use-toast";
    import { useDebounce } from 'use-debounce';
    import { apiClient } from '@/lib/apiClient';
    import { useAuth } from '@/contexts/AuthContext';
    import { logAuditEvent } from '@/lib/auditUtils';
    import { parseISO } from 'date-fns';
    import InvoiceReceiptsTable from './invoicing_and_receipts/InvoiceReceiptsTable';
    import ReceiptPreviewDialog from './invoicing_and_receipts/ReceiptPreviewDialog';
    import ReceiptConfirmationDialog from './invoicing_and_receipts/ReceiptConfirmationDialog';
    import { generateReceiptPDF } from './invoicing_and_receipts/receiptGenerator';

    const InvoicingAndReceipts = () => {
      const { toast } = useToast();
      const { user } = useAuth();
      const [orders, setOrders] = useState([]);
      const [isLoading, setIsLoading] = useState(false);
      
      const [dateRange, setDateRange] = useState({ from: new Date(new Date().setDate(new Date().getDate() - 30)), to: new Date() });
      const [searchTerm, setSearchTerm] = useState('');
      const [debouncedSearchTerm] = useDebounce(searchTerm, 500);

      const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
      const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState(null);
      
      const [isReceiptPreviewOpen, setIsReceiptPreviewOpen] = useState(false);
      const [receiptPdfUrl, setReceiptPdfUrl] = useState('');
      const iframeRef = useRef(null);

      const loadOrders = useCallback(async () => {
        setIsLoading(true);
        try {
            // Fetch all recent work orders then filter client side for statuses needed
            const data = await apiClient.get('/work-orders');
            const filtered = (data||[]).filter(o => ['Reportada','Concluida','Entregada'].includes(o.status));
            // Enrich patient/referrer names if necessary (would need extra fetches; kept minimal for now)
            setOrders(filtered.map(o => ({...o, fecha: parseISO(o.order_date)})));
        } catch (error) {
            toast({ title: "Error", description: "No se pudieron cargar las órdenes.", variant: "destructive" });
            console.error(error);
        } finally {
            setIsLoading(false);
        }
      }, [toast]);

      useEffect(() => {
        loadOrders();
      }, [loadOrders]);

      const handleGenerateInvoice = async (order) => {
        toast({
          title: "🚧 Facturación (CFDI) Próximamente",
          description: `La generación de facturas electrónicas CFDI para la orden ${order.folio} aún no está implementada.`,
          duration: 5000,
        });
      };
      
      const handleGenerateReceipt = (order) => {
        setSelectedOrderForReceipt(order);
        setIsReceiptModalOpen(true);
      };

      const generateAndPreviewReceipt = async (order) => {
        if (!order) return;
      
        setIsLoading(true);
        setIsReceiptModalOpen(false);
        try {
          const pdfDataUri = await generateReceiptPDF(order);
          setReceiptPdfUrl(pdfDataUri);
          setIsReceiptPreviewOpen(true);
          
          try {
            await apiClient.put(`/work-orders/${order.id}`, { receipt_generated: true });
            logAuditEvent('Finanzas:ReciboGenerado', { orderId: order.id, folio: order.folio });
            toast({ title: 'Recibo Generado', description: `Se ha generado el recibo para la orden ${order.folio}.` });
            await loadOrders();
          } catch (error) {
            toast({ title: 'Error', description: 'No se pudo actualizar el estado del recibo.', variant: 'destructive' });
          }
        } catch (e) {
          console.error("Failed to generate PDF:", e);
          toast({ title: "Error Inesperado", description: "No se pudo generar el recibo en PDF. Revise la consola para más detalles.", variant: "destructive"});
        } finally {
          setIsLoading(false);
        }
      };

      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          <Card className="shadow-xl glass-card overflow-hidden">
            <CardHeader className="bg-gradient-to-br from-sky-50 via-cyan-50 to-teal-50 dark:from-sky-900/70 dark:via-cyan-900/70 dark:to-teal-900/70 p-6">
              <div className="flex items-center">
                <FileText className="h-10 w-10 mr-4 text-sky-600 dark:text-sky-400" />
                <div>
                  <CardTitle className="text-3xl font-bold text-sky-700 dark:text-sky-300">
                    Facturación y Recibos
                  </CardTitle>
                  <CardDescription className="text-slate-600 dark:text-slate-400">
                    Genera documentos fiscales y comprobantes de pago para tus órdenes.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <Tabs defaultValue="receipts" className="w-full">
                <TabsList className="grid w-full grid-cols-2 md:w-1/2 mb-6">
                  <TabsTrigger value="invoices">Facturas (CFDI)</TabsTrigger>
                  <TabsTrigger value="receipts">Recibos de Pago</TabsTrigger>
                </TabsList>
                <TabsContent value="invoices">
                  <InvoiceReceiptsTable
                    type="invoice"
                    orders={orders}
                    isLoading={isLoading}
                    dateRange={dateRange}
                    setDateRange={setDateRange}
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    debouncedSearchTerm={debouncedSearchTerm}
                    onAction={handleGenerateInvoice}
                    loadOrders={loadOrders}
                  />
                </TabsContent>
                <TabsContent value="receipts">
                  <InvoiceReceiptsTable
                    type="receipt"
                    orders={orders}
                    isLoading={isLoading}
                    dateRange={dateRange}
                    setDateRange={setDateRange}
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    debouncedSearchTerm={debouncedSearchTerm}
                    onAction={handleGenerateReceipt}
                    loadOrders={loadOrders}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <ReceiptConfirmationDialog
            isOpen={isReceiptModalOpen}
            onOpenChange={setIsReceiptModalOpen}
            selectedOrder={selectedOrderForReceipt}
            onConfirm={generateAndPreviewReceipt}
            isLoading={isLoading}
          />

          <ReceiptPreviewDialog
            isOpen={isReceiptPreviewOpen}
            onOpenChange={setIsReceiptPreviewOpen}
            selectedOrder={selectedOrderForReceipt}
            pdfUrl={receiptPdfUrl}
            iframeRef={iframeRef}
          />

        </motion.div>
      );
    };

    export default InvoicingAndReceipts;