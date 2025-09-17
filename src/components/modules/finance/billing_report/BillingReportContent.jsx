import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from 'date-fns';

const BillingReportContent = ({ data }) => {
  const { groupedData, grandTotal } = data;

  return (
    <div className="space-y-6">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Paciente</TableHead>
            <TableHead>Folio Orden</TableHead>
            <TableHead>Referencia</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Estudio</TableHead>
            <TableHead className="text-right">Costo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Object.entries(groupedData).map(([patientName, patientData], patientIndex) => (
            <React.Fragment key={patientName}>
              {patientData.orders.flatMap((order, orderIndex) =>
                order.selected_items.map((item, itemIndex) => (
                  <TableRow key={`${order.folio}-${itemIndex}`}>
                    {orderIndex === 0 && itemIndex === 0 && (
                      <TableCell rowSpan={patientData.orders.reduce((acc, o) => acc + o.selected_items.length, 0)} className="align-top font-semibold text-slate-800 dark:text-slate-200">
                        {patientName}
                      </TableCell>
                    )}
                    {itemIndex === 0 && (
                      <>
                        <TableCell rowSpan={item.selected_items_count || order.selected_items.length} className="align-top font-medium">{order.folio}</TableCell>
                        <TableCell rowSpan={item.selected_items_count || order.selected_items.length} className="align-top">{order.institution_reference || '-'}</TableCell>
                        <TableCell rowSpan={item.selected_items_count || order.selected_items.length} className="align-top">{format(new Date(order.order_date), 'dd/MM/yyyy')}</TableCell>
                      </>
                    )}
                    <TableCell>{item.nombre}</TableCell>
                    <TableCell className="text-right">{(item.precio || 0).toFixed(2)}</TableCell>
                  </TableRow>
                ))
              )}
              <TableRow className="bg-slate-100 dark:bg-slate-800 font-bold">
                <TableCell colSpan={5} className="text-right">Subtotal Paciente:</TableCell>
                <TableCell className="text-right">{patientData.subtotal.toFixed(2)}</TableCell>
              </TableRow>
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
      <div className="text-right mt-6">
        <p className="text-xl font-bold text-purple-700 dark:text-purple-400">
          Total a Facturar: {grandTotal.toFixed(2)} MXN
        </p>
      </div>
    </div>
  );
};

export default BillingReportContent;