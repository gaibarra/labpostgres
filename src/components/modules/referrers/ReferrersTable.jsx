import React from 'react';
import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Edit, Trash2, FileText, Phone, Mail, MapPin, MessageCircle } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
            {/* Referente: avatar + nombre */}
            <TableHead className="w-[280px] text-slate-700 dark:text-slate-300">Referente</TableHead>
            <TableHead className="text-slate-700 dark:text-slate-300 hidden sm:table-cell">Tipo</TableHead>
            {/* Especialidad más angosta */}
            <TableHead className="w-[120px] md:w-[140px] text-slate-700 dark:text-slate-300 hidden md:table-cell">Especialidad</TableHead>
            <TableHead className="text-slate-700 dark:text-slate-300 hidden lg:table-cell">Contacto</TableHead>
            <TableHead className="text-slate-700 dark:text-slate-300 hidden xl:table-cell w-[320px]">Dirección</TableHead>
            <TableHead className="text-right text-slate-700 dark:text-slate-300 sticky right-0 z-10 bg-slate-100 dark:bg-slate-800">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {referrers.length > 0 ? (
            referrers.map((referrer) => (
              <TableRow key={referrer.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <TableCell className="font-medium text-slate-800 dark:text-slate-200 align-top">
                  <div className="space-y-1">
                    <div className="flex items-start gap-3 min-w-0">
                      <Avatar className="h-9 w-9 ring-2 ring-slate-200 dark:ring-slate-700">
                        <AvatarFallback className="bg-sky-50 text-sky-700 text-xs">
                          {String(referrer.name||'?').split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="truncate" title={referrer.name}>{referrer.name}</div>
                        <div className="flex flex-wrap gap-1.5 mt-0.5">
                          {referrer.entity_type && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-[11px] text-slate-700 dark:text-slate-300">{referrer.entity_type}</span>
                          )}
                          {referrer.specialty && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-slate-800 border border-emerald-200 dark:border-slate-600 text-[11px] text-emerald-700 dark:text-emerald-300">{referrer.specialty}</span>
                          )}
                        </div>
                      </div>
                    </div>
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
                <TableCell className="text-slate-600 dark:text-slate-400 hidden lg:table-cell">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" className="h-7 w-7" asChild disabled={!referrer.phone_number}>
                      <a href={referrer.phone_number ? `tel:${referrer.phone_number}` : undefined} title="Llamar"><Phone className="h-3.5 w-3.5"/></a>
                    </Button>
                    <Button variant="outline" size="icon" className="h-7 w-7" asChild disabled={!referrer.phone_number}>
                      <a href={referrer.phone_number ? `https://wa.me/${String(referrer.phone_number).replace(/\D/g,'')}` : undefined} target="_blank" rel="noreferrer" title="WhatsApp"><MessageCircle className="h-3.5 w-3.5 text-green-600"/></a>
                    </Button>
                    <Button variant="outline" size="icon" className="h-7 w-7" asChild disabled={!referrer.email}>
                      <a href={referrer.email ? `mailto:${referrer.email}` : undefined} title="Email"><Mail className="h-3.5 w-3.5 text-sky-600"/></a>
                    </Button>
                  </div>
                </TableCell>
                <TableCell className="text-slate-600 dark:text-slate-400 hidden xl:table-cell w-[320px] truncate" title={referrer.address || ''}>
                  <div className="flex items-center gap-2">
                    <span className="truncate">{referrer.address || '___'}</span>
                    {referrer.address && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(referrer.address)}`} target="_blank" rel="noreferrer" title="Abrir en Maps">
                          <MapPin className="h-4 w-4 text-rose-600"/>
                        </a>
                      </Button>
                    )}
                  </div>
                </TableCell>
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