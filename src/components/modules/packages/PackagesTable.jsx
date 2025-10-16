import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Search, DollarSign, MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const PackagesTable = ({
  filteredPackages,
  getParticularPrice,
  getItemNameByIdAndType,
  handleEdit,
  openDeleteConfirmDialog,
  isSubmitting
}) => {
  // Per-row expand/collapse state
  const [expandedRows, setExpandedRows] = useState({});
  const toggleRow = (id) => setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));

  if (filteredPackages.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500 dark:text-slate-400 h-full flex flex-col justify-center items-center">
        <Search className="mx-auto h-12 w-12 mb-4 text-gray-400" />
        <p className="font-semibold text-lg">No se encontraron paquetes.</p>
        <p className="text-sm">Intenta ajustar tu búsqueda o registra un nuevo paquete.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-slate-200 dark:border-slate-700 shadow-inner">
      <Table>
        <TableHeader className="sticky top-0 bg-slate-100 dark:bg-slate-800 z-10">
          <TableRow>
            <TableHead className="w-[250px] text-slate-700 dark:text-slate-300">Nombre</TableHead>
            <TableHead className="text-slate-700 dark:text-slate-300">Items Incluidos</TableHead>
            <TableHead className="text-slate-700 dark:text-slate-300">
              <div className="flex items-center">
                <DollarSign className="h-4 w-4 mr-1 text-green-500" /> Precio Base
              </div>
            </TableHead>
            <TableHead className="text-right text-slate-700 dark:text-slate-300 sticky right-0 z-10 bg-slate-100 dark:bg-slate-800">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredPackages.map((pkg) => {
            const items = Array.isArray(pkg.items) ? pkg.items : [];
            const isExpanded = !!expandedRows[pkg.id];
            const COMPACT_COUNT = 8; // visible chips in compact mode (per row)
            const visibleItems = isExpanded ? items : items.slice(0, COMPACT_COUNT);
            const isStudyType = (t) => t === 'study' || t === 'analysis';
            const visibleStudies = visibleItems.filter(i => isStudyType(i.item_type));
            const visiblePackages = visibleItems.filter(i => i.item_type === 'package');
            const hasMoreHidden = !isExpanded && items.length > COMPACT_COUNT;

            return (
            <TableRow key={pkg.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <TableCell className="font-medium text-slate-800 dark:text-slate-200">{pkg.name}</TableCell>
              <TableCell className="text-slate-600 dark:text-slate-400 text-xs whitespace-normal break-words">
                <div className="space-y-1">
                  {visibleStudies.length > 0 && (
                    <div>
                      <div className="uppercase tracking-wide text-[10px] text-slate-500 dark:text-slate-400 mb-1">Estudios</div>
                      <div className="flex flex-wrap gap-1.5">
                        {visibleStudies.map((item, idx) => {
                          const name = getItemNameByIdAndType(item.item_id, item.item_type);
                          return (
                            <button
                              key={`pkg-${pkg.id}-study-${idx}`}
                              type="button"
                              onClick={() => handleEdit(pkg)}
                              className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600 bg-sky-50 dark:bg-slate-800/60 text-[11px] text-slate-700 dark:text-slate-300 hover:bg-sky-100 hover:underline cursor-pointer"
                              title={`Editar ${pkg.name}`}
                            >
                              {name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {visiblePackages.length > 0 && (
                    <div>
                      <div className="uppercase tracking-wide text-[10px] text-slate-500 dark:text-slate-400 mb-1">Paquetes</div>
                      <div className="flex flex-wrap gap-1.5">
                        {visiblePackages.map((item, idx) => {
                          const name = getItemNameByIdAndType(item.item_id, item.item_type);
                          return (
                            <button
                              key={`pkg-${pkg.id}-package-${idx}`}
                              type="button"
                              onClick={() => handleEdit(pkg)}
                              className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600 bg-emerald-50 dark:bg-slate-800/60 text-[11px] text-slate-700 dark:text-slate-300 hover:bg-emerald-100 hover:underline cursor-pointer"
                              title={`Editar ${pkg.name}`}
                            >
                              {name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Total: {items.length}</div>
                  <button
                    type="button"
                    className="text-[11px] text-sky-600 hover:text-sky-700 dark:text-sky-400 hover:underline"
                    onClick={() => toggleRow(pkg.id)}
                  >
                    {isExpanded ? 'Compactar' : (hasMoreHidden ? `Expandir (${items.length - COMPACT_COUNT} más)` : 'Compacto')}
                  </button>
                </div>
              </TableCell>
              <TableCell className="text-slate-600 dark:text-slate-400 font-semibold">{getParticularPrice(pkg.id)} MXN</TableCell>
              <TableCell className="text-right sticky right-0 z-10 bg-slate-50 dark:bg-slate-900">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0" disabled={isSubmitting}>
                      <span className="sr-only">Abrir menú</span>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-white dark:bg-slate-900 shadow-lg border-slate-200 dark:border-slate-700">
                    <DropdownMenuItem onClick={() => handleEdit(pkg)} disabled={isSubmitting} className="cursor-pointer">
                      <Edit className="mr-2 h-4 w-4 text-blue-500" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openDeleteConfirmDialog(pkg)} className="cursor-pointer text-red-500 focus:text-red-600" disabled={isSubmitting}>
                      <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          );})}
        </TableBody>
      </Table>
    </div>
  );
};

export default PackagesTable;