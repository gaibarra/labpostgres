import React, { useEffect } from 'react';
    import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { DatePickerWithRange } from '@/components/ui/datepicker';
    import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
    import { FileText, Search, AlertCircle, CheckCircle2, Loader2, Eye } from 'lucide-react';
    import { format, isValid } from 'date-fns';

    const InvoiceReceiptsTable = ({
      type,
      orders,
      isLoading,
      dateRange,
      setDateRange,
      searchTerm,
      setSearchTerm,
      debouncedSearchTerm,
      onAction,
      loadOrders,
    }) => {
      const isInvoice = type === 'invoice';
      const relevantOrders = isInvoice ? orders : orders.filter(o => (o.total_price || 0) > 0);

      useEffect(() => {
        loadOrders();
      }, [dateRange, debouncedSearchTerm, loadOrders]);

      const filteredOrders = relevantOrders.filter(order => {
        const searchTermLower = debouncedSearchTerm.toLowerCase();
        return (
          order.folio?.toLowerCase().includes(searchTermLower) ||
          order.patient?.full_name?.toLowerCase().includes(searchTermLower) ||
          order.referrer?.name?.toLowerCase().includes(searchTermLower)
        );
      });

      return (
        <Card className="bg-slate-50 dark:bg-slate-800/60 shadow-md">
          <CardHeader>
            <CardTitle className="text-xl text-slate-700 dark:text-slate-200">
              {isInvoice ? 'Generación de Facturas (CFDI)' : 'Generación de Recibos de Pago'}
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400">
              {isInvoice 
                ? 'La generación de CFDI requiere integración con un PAC. Esta funcionalidad es una simulación.'
                : 'Genera recibos simples para las órdenes. Estos no son CFDI.'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <DatePickerWithRange date={dateRange} onDateChange={setDateRange} className="md:w-auto" disabled={isLoading} />
              <div className="relative w-full md:w-1/2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input 
                  type="text" 
                  placeholder="Buscar por folio, paciente, referente..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-white dark:bg-slate-700"
                  disabled={isLoading}
                />
              </div>
            </div>
            {isLoading ? (
              <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-sky-500" /></div>
            ) : filteredOrders.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Folio</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Paciente</TableHead>
                      <TableHead className="text-right">Total (MXN)</TableHead>
                      <TableHead className="text-center">Estado</TableHead>
                      <TableHead className="text-center">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map(order => {
                      const isGenerated = isInvoice ? order.is_invoiced : order.receipt_generated;
                      return (
                        <TableRow key={order.id}>
                          <TableCell>{order.folio}</TableCell>
                          <TableCell>{isValid(order.fecha) ? format(order.fecha, 'dd/MM/yyyy') : 'Inválida'}</TableCell>
                          <TableCell>{order.patient?.full_name || 'N/A'}</TableCell>
                          <TableCell className="text-right">{(order.total_price || 0).toFixed(2)}</TableCell>
                          <TableCell className="text-center">
                            {isGenerated ? 
                              <span className="text-green-600 dark:text-green-400 font-medium flex items-center justify-center"><CheckCircle2 className="mr-1 h-4 w-4"/>Generado</span> : 
                              <span className="text-orange-600 dark:text-orange-400 font-medium flex items-center justify-center"><AlertCircle className="mr-1 h-4 w-4"/>Pendiente</span>
                            }
                          </TableCell>
                          <TableCell className="text-center">
                            <Button variant="outline" size="sm" onClick={() => onAction(order)} disabled={(isInvoice && isGenerated) || isLoading}>
                              {isInvoice ? <FileText className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                              {isGenerated ? (isInvoice ? 'Ver' : 'Ver') : 'Generar'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <AlertCircle className="mx-auto h-12 w-12 mb-2 opacity-50" />
                <p>No se encontraron órdenes que coincidan con los filtros.</p>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <p className="text-sm text-muted-foreground">Mostrando {filteredOrders.length} de {orders.length} órdenes totales.</p>
          </CardFooter>
        </Card>
      );
    };

    export default InvoiceReceiptsTable;