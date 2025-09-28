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
            <TableHead className="w-[240px] md:w-[280px] text-slate-700 dark:text-slate-300">Nombre</TableHead>
            <TableHead className="text-slate-700 dark:text-slate-300 hidden sm:table-cell">Tipo</TableHead>
            {/* Especialidad más angosta */}
            <TableHead className="w-[120px] md:w-[140px] text-slate-700 dark:text-slate-300 hidden md:table-cell">Especialidad</TableHead>
            <TableHead className="text-slate-700 dark:text-slate-300 hidden lg:table-cell">Teléfono</TableHead>
            <TableHead className="text-slate-700 dark:text-slate-300 hidden lg:table-cell">Email</TableHead>
            <TableHead className="text-slate-700 dark:text-slate-300 hidden xl:table-cell w-[280px]">Dirección</TableHead>
            <TableHead className="text-right text-slate-700 dark:text-slate-300 sticky right-0 z-10 bg-slate-100 dark:bg-slate-800">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {referrers.length > 0 ? (
            referrers.map((referrer) => (
              <TableRow key={referrer.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <TableCell className="font-medium text-slate-800 dark:text-slate-200 w-[240px] md:w-[280px] align-top">
                  <div className="space-y-1">
                    <div>{referrer.name}</div>
                    {/* Bloque compacto sólo visible en pantallas < sm */}
                    <div className="sm:hidden text-xs text-slate-500 dark:text-slate-400 leading-snug space-y-0.5">
                      <div><span className="font-semibold">Tipo:</span> {referrer.entity_type || '___'}</div>
                      <div><span className="font-semibold">Esp:</span> {referrer.specialty || '___'}</div>
                      <div><span className="font-semibold">Tel:</span> {referrer.phone_number || '___'}</div>
                      <div><span className="font-semibold">Email:</span> {referrer.email || '___'}</div>
                      <div className="truncate" title={referrer.address || ''}><span className="font-semibold">Dir:</span> {referrer.address || '___'}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-slate-600 dark:text-slate-400 hidden sm:table-cell">{referrer.entity_type}</TableCell>
                <TableCell className="text-slate-600 dark:text-slate-400 w-[120px] md:w-[140px] truncate hidden md:table-cell" title={referrer.specialty || ''}>{referrer.specialty || '___'}</TableCell>
                <TableCell className="text-slate-600 dark:text-slate-400 hidden lg:table-cell">{referrer.phone_number || '___'}</TableCell>
                <TableCell className="text-slate-600 dark:text-slate-400 hidden lg:table-cell">{referrer.email || '___'}</TableCell>
                <TableCell className="text-slate-600 dark:text-slate-400 hidden xl:table-cell w-[280px] truncate" title={referrer.address || ''}>{referrer.address || '___'}</TableCell>
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
              <TableCell colSpan={7} className="h-24 text-center text-slate-500 dark:text-slate-400">
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