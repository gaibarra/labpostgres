import React from 'react';
    import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
    import { Button } from '@/components/ui/button';
    import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
    import {
      Edit3, Trash2, FileText, QrCode, FileEdit as FileEditIcon,
      CheckSquare, Search, MoreVertical, FileSpreadsheet, Loader2, Sparkles
    } from 'lucide-react';
    import {
      DropdownMenu,
      DropdownMenuContent,
      DropdownMenuItem,
      DropdownMenuLabel,
      DropdownMenuSeparator,
      DropdownMenuTrigger,
    } from "@/components/ui/dropdown-menu";
    import { formatInTimeZone } from '@/lib/dateUtils';

    const OrdersTable = ({ 
      orders, 
      isLoading,
      onEdit, 
      onDelete, 
      onOpenModal
    }) => {

      if (isLoading) {
        return (
          <div className="flex flex-col items-center justify-center text-center py-12 text-slate-500 dark:text-slate-400">
            <Loader2 className="mx-auto h-12 w-12 animate-spin mb-4" />
            <p className="font-semibold text-lg">Cargando órdenes...</p>
            <p className="text-sm">Por favor, espera un momento.</p>
          </div>
        );
      }

      if (!orders || orders.length === 0) {
        return (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">
            <Search className="mx-auto h-12 w-12 mb-4" />
            <p className="font-semibold text-lg">No se encontraron órdenes.</p>
            <p className="text-sm">Intenta ajustar tu búsqueda o registra una nueva orden.</p>
          </div>
        );
      }

      return (
        <Table className="min-w-full">
          <TableHeader>
            <TableRow>
              <TableHead className="text-slate-800 dark:text-slate-200">Folio</TableHead>
              <TableHead className="text-slate-800 dark:text-slate-200">Fecha</TableHead>
              <TableHead className="text-slate-800 dark:text-slate-200">Paciente</TableHead>
              <TableHead className="text-slate-800 dark:text-slate-200">Edad</TableHead>
              <TableHead className="text-slate-800 dark:text-slate-200">Total</TableHead>
              <TableHead className="text-slate-800 dark:text-slate-200">Estado</TableHead>
              <TableHead className="text-right text-slate-800 dark:text-slate-200">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id} className="hover:bg-slate-100/50 dark:hover:bg-slate-800/50">
                <TableCell className="font-mono text-xs text-slate-600 dark:text-slate-400">{order.folio}</TableCell>
                <TableCell className="text-slate-600 dark:text-slate-400">{formatInTimeZone(order.order_date, "dd/MM/yyyy")}</TableCell>
                <TableCell className="font-medium text-slate-700 dark:text-slate-300">{order.patient_name}</TableCell>
                <TableCell className="text-slate-600 dark:text-slate-400 text-sm">
                  {order.patient?.age?.ageYears ?? 'N/A'}
                </TableCell>
                <TableCell className="text-slate-600 dark:text-slate-400">{(() => {
                  const n = typeof order.total_price === 'number' ? order.total_price : Number(order.total_price);
                  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
                })()} MXN</TableCell>
                <TableCell>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    order.status === 'Pendiente' ? 'bg-yellow-200 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-100' :
                    order.status === 'Procesando' ? 'bg-orange-200 text-orange-800 dark:bg-orange-700 dark:text-orange-100' :
                    order.status === 'Concluida' ? 'bg-blue-200 text-blue-800 dark:bg-blue-700 dark:text-blue-100' :
                    order.status === 'Reportada' ? 'bg-green-200 text-green-800 dark:bg-green-700 dark:text-green-100' :
                    order.status === 'Cancelada' ? 'bg-red-200 text-red-800 dark:bg-red-700 dark:text-red-100' :
                    'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100'
                  }`}>
                    {order.status}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                   <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Abrir menú</span>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onEdit(order)}>
                        <Edit3 className="mr-2 h-4 w-4" /> Editar Orden
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onOpenModal('results', order)}>
                        <FileEditIcon className="mr-2 h-4 w-4" /> Registrar Resultados
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                       <DropdownMenuItem onClick={() => onOpenModal('preview', order)}>
                        <FileText className="mr-2 h-4 w-4" /> Ver Comprobante
                      </DropdownMenuItem>
                       <DropdownMenuItem onClick={() => onOpenModal('worksheet', order)}>
                        <FileSpreadsheet className="mr-2 h-4 w-4" /> Hoja de Trabajo
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onOpenModal('labels-preview', order)}>
                        <QrCode className="mr-2 h-4 w-4" /> Imprimir Etiquetas
                      </DropdownMenuItem>
                      {(order.status === 'Reportada' || order.status === 'Concluida') &&
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => onOpenModal('report', order)}>
                            <CheckSquare className="mr-2 h-4 w-4" /> Ver Reporte Final
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onOpenModal('ai-recommendations', order)} className="text-purple-600 dark:text-purple-400 focus:text-purple-700 dark:focus:text-purple-300">
                            <Sparkles className="mr-2 h-4 w-4" /> Asistente IA
                          </DropdownMenuItem>
                        </>
                      }
                      <DropdownMenuSeparator />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <DropdownMenuItem 
                            className="text-red-600 dark:text-red-500 focus:text-red-600 dark:focus:text-red-500"
                            onSelect={(e) => e.preventDefault()}
                            disabled={order.status === 'Reportada' || order.status === 'Concluida'}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Eliminar Orden
                          </DropdownMenuItem>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-slate-50 dark:bg-slate-900">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-red-600 dark:text-red-400">¿Estás seguro?</AlertDialogTitle>
                            <AlertDialogDescription className="text-slate-600 dark:text-slate-400">
                              Esta acción no se puede deshacer. Esto eliminará permanentemente la orden <span className="font-semibold">{order.folio}</span>.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onDelete(order)} className="bg-red-500 hover:bg-red-600 text-white">Eliminar</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      );
    };

    export default OrdersTable;