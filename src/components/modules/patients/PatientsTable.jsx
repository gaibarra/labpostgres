import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, BarChart2 } from 'lucide-react';
// Evitar ambigüedad día/mes mostrando mes abreviado en texto (Ene, Feb, ...)
// y evitar desplazamientos de zona horaria no parseando a Date cuando ya viene YYYY-MM-DD.
// Se elimina date-fns para DOB específico para prevenir offset issues y depender solo de la cadena.
// (Si en el futuro date_of_birth incluye tiempo, reconsiderar.)
// import { format, parseISO } from 'date-fns';
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
              {(() => {
                const label = p.sex === 'M' ? 'Masculino' : p.sex === 'F' ? 'Femenino' : (p.sex || '');
                return (
                  <Badge variant={label === 'Masculino' ? 'default' : 'secondary'}>
                    {label}
                  </Badge>
                );
              })()}
            </TableCell>
            <TableCell>{(() => {
              const dob = p.date_of_birth;
              if (!dob) return 'N/A';
              // Esperado formato YYYY-MM-DD
              if (/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
                const [y, m, d] = dob.split('-');
                const MONTH_ABBR = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
                const idx = parseInt(m, 10) - 1;
                const month = MONTH_ABBR[idx] || m;
                return `${d} ${month} ${y}`; // ej: 03 Ene 1965
              }
              return dob; // fallback sin transformar
            })()}</TableCell>
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