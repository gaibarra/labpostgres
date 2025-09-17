import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, BarChart2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';

const PatientsTable = ({ patients, onEdit, onDelete, onViewHistory }) => {
  if (!patients || patients.length === 0) {
    return <div className="text-center py-8">No se encontraron pacientes.</div>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nombre</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Móvil</TableHead>
          <TableHead>Sexo</TableHead>
          <TableHead>Fecha Nac.</TableHead>
          <TableHead className="text-right sticky right-0 z-10 bg-slate-50 dark:bg-slate-900">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {patients.map(p => (
          <TableRow key={p.id}>
            <TableCell className="font-medium">{p.full_name}</TableCell>
            <TableCell>{p.email}</TableCell>
            <TableCell>{p.phone_number}</TableCell>
            <TableCell>
              <Badge variant={p.sex === 'Masculino' ? 'default' : 'secondary'}>
                {p.sex}
              </Badge>
            </TableCell>
            <TableCell>{p.date_of_birth ? format(parseISO(p.date_of_birth), 'dd/MM/yyyy') : 'N/A'}</TableCell>
            <TableCell className="text-right space-x-1 sticky right-0 z-10 bg-slate-50 dark:bg-slate-900">
              <Button variant="ghost" size="icon" onClick={() => onViewHistory(p.id)} className="text-green-500 hover:text-green-700">
                <BarChart2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onEdit(p)} className="text-blue-500 hover:text-blue-700">
                <Edit className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onDelete(p)} className="text-red-500 hover:text-red-700">
                <Trash2 className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default PatientsTable;