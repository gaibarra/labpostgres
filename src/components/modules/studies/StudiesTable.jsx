import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Edit3, Trash2, DollarSign, Search as SearchIcon, Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import EmptyState from '@/components/ui/EmptyState';

const StudiesTable = ({ studies, onEdit, onDeleteConfirm, onAssignPrices, getParticularPrice }) => {
  if (!studies || studies.length === 0) {
    return (
      <div className="p-4">
        <EmptyState 
          icon={SearchIcon}
          title="No se encontraron estudios"
          description="Intenta ajustar tu búsqueda o crea un nuevo estudio para empezar."
        />
      </div>
    );
  }

  return (
    <AlertDialog>
      <Table className="min-w-full">
        <TableHeader>
          <TableRow>
            <TableHead className="text-slate-800 dark:text-slate-200 whitespace-nowrap">Clave</TableHead>
            <TableHead className="text-slate-800 dark:text-slate-200 min-w-[200px] whitespace-nowrap">Nombre</TableHead>
            <TableHead className="text-slate-800 dark:text-slate-200 whitespace-nowrap">Categoría</TableHead>
            <TableHead className="text-slate-800 dark:text-slate-200 whitespace-nowrap"><DollarSign className="h-4 w-4 mr-1 text-green-600 dark:text-green-400 inline-block"/>Precio Particular</TableHead>
            <TableHead className="text-slate-800 dark:text-slate-200 whitespace-nowrap">Parámetros</TableHead>
            <TableHead className="sticky right-0 z-10 bg-slate-50 dark:bg-slate-900 text-right text-slate-800 dark:text-slate-200 whitespace-nowrap">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {studies.map((study) => (
            <TableRow key={study.id} className="hover:bg-slate-100/50 dark:hover:bg-slate-800/50">
              <TableCell className="font-mono text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">{study.clave}</TableCell>
              <TableCell className="font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">{study.name}</TableCell>
              <TableCell className="whitespace-nowrap">
                <Badge variant="secondary">{study.category}</Badge>
              </TableCell>
              <TableCell className="text-slate-600 dark:text-slate-400 font-semibold whitespace-nowrap">
                {(() => {
                  const raw = getParticularPrice(study.id);
                  // Si viene ya como string "0.00" o similar, parsear
                  const num = parseFloat(raw);
                  if (isNaN(num)) return raw || '-';
                  // Formato moneda MXN sin decimales forzados si .00, conservando 2 decimales de lo contrario
                  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }).format(num);
                })()}
              </TableCell>
              <TableCell className="text-slate-600 dark:text-slate-400 text-sm whitespace-nowrap">
                {study.parameters && study.parameters.length > 0 ? 
                  `${study.parameters.length} Parámetro(s)`
                  : 'N/A'
                }
              </TableCell>
              <TableCell className="sticky right-0 z-10 bg-slate-50 dark:bg-slate-900 text-right space-x-1 whitespace-nowrap">
                <Button variant="ghost" size="icon" onClick={() => onAssignPrices(study)} className="text-teal-500 hover:text-teal-700">
                  <Tag className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onEdit(study)} className="text-blue-500 hover:text-blue-700">
                  <Edit3 className="h-4 w-4" />
                </Button>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => onDeleteConfirm(study)} className="text-red-500 hover:text-red-700">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </AlertDialog>
  );
};

export default StudiesTable;