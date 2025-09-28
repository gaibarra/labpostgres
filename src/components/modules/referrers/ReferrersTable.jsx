import React from 'react';
import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Edit, Trash2, FileText } from 'lucide-react';
import PriceListTrigger from './PriceListTrigger';

const ReferrersTable = ({ 
  referrers, 
  handleEdit, 
  openDeleteConfirm,
  openPriceListPDFModal,
  studies,
  packagesData,
  onUpdateReferrerPrices,
  particularReferrer,
  isSubmitting
}) => {
  return (
    <div className="rounded-md border border-slate-200 dark:border-slate-700 shadow-inner">
      <Table>
        <TableHeader className="sticky top-0 bg-slate-100 dark:bg-slate-800 z-10">
          <TableRow>
            {/* Nombre más ancho */}
            <TableHead className="w-[280px] text-slate-700 dark:text-slate-300">Nombre</TableHead>
            <TableHead className="text-slate-700 dark:text-slate-300">Tipo</TableHead>
            {/* Especialidad más angosta */}
            <TableHead className="w-[140px] text-slate-700 dark:text-slate-300">Especialidad</TableHead>
            <TableHead className="text-slate-700 dark:text-slate-300">Teléfono</TableHead>
            <TableHead className="text-slate-700 dark:text-slate-300">Email</TableHead>
            <TableHead className="text-right text-slate-700 dark:text-slate-300 sticky right-0 z-10 bg-slate-100 dark:bg-slate-800">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {referrers.length > 0 ? (
            referrers.map((referrer) => (
              <TableRow key={referrer.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <TableCell className="font-medium text-slate-800 dark:text-slate-200 w-[280px]">{referrer.name}</TableCell>
                <TableCell className="text-slate-600 dark:text-slate-400">{referrer.entity_type}</TableCell>
                <TableCell className="text-slate-600 dark:text-slate-400 w-[140px] truncate" title={referrer.specialty || ''}>{referrer.specialty || '___'}</TableCell>
                <TableCell className="text-slate-600 dark:text-slate-400">{referrer.phone_number || '___'}</TableCell>
                <TableCell className="text-slate-600 dark:text-slate-400">{referrer.email || '___'}</TableCell>
                <TableCell className="text-right sticky right-0 z-10 bg-slate-50 dark:bg-slate-900">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0" disabled={isSubmitting}>
                        <span className="sr-only">Abrir menú</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-white dark:bg-slate-900 shadow-lg border-slate-200 dark:border-slate-700">
                      {referrer.name !== 'Particular' && (
                        <DropdownMenuItem onClick={() => handleEdit(referrer)} className="cursor-pointer" disabled={isSubmitting}>
                          <Edit className="mr-2 h-4 w-4 text-blue-500" />
                          Editar Datos
                        </DropdownMenuItem>
                      )}
                      <PriceListTrigger
                          referrer={referrer}
                          studies={studies}
                          packagesData={packagesData}
                          onUpdateReferrerPrices={onUpdateReferrerPrices}
                          particularReferrer={particularReferrer}
                          isSubmitting={isSubmitting}
                       />
                      <DropdownMenuItem onClick={() => openPriceListPDFModal(referrer)} className="cursor-pointer" disabled={isSubmitting}>
                        <FileText className="mr-2 h-4 w-4 text-indigo-500" />
                        Ver Lista (PDF)
                      </DropdownMenuItem>
                      {referrer.name !== 'Particular' && (
                        <DropdownMenuItem onClick={() => openDeleteConfirm(referrer)} className="cursor-pointer text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400" disabled={isSubmitting}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Eliminar
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center text-slate-500 dark:text-slate-400">
                No se encontraron referentes.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default ReferrersTable;