import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Edit, Trash2, BarChart2, MoreVertical, Phone, Mail } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';

const PatientsCardView = ({ patients, onEdit, onDelete, onViewHistory }) => {
  if (!patients || patients.length === 0) {
    return <div className="text-center py-8">No se encontraron pacientes.</div>;
  }
  return (
    <div className="grid grid-cols-1 gap-4 p-4">
      {patients.map(p => (
        <Card key={p.id} className="bg-card/80 dark:bg-card/70">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <CardTitle className="text-lg font-bold text-indigo-800 dark:text-indigo-300">{p.full_name}</CardTitle>
                <div className="flex items-center text-xs text-muted-foreground mt-1">
                  {(() => { const label = p.sex === 'M' ? 'Masculino' : p.sex === 'F' ? 'Femenino' : (p.sex || ''); return <Badge variant={label === 'Masculino' ? 'default' : 'secondary'} className="mr-2">{label}</Badge>; })()}
                  <span>Nac: {p.date_of_birth ? format(parseISO(p.date_of_birth), 'dd/MM/yyyy') : 'N/A'}</span>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onViewHistory(p.id)} className="text-green-600 dark:text-green-400">
                    <BarChart2 className="mr-2 h-4 w-4" /> Ver Historial
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onEdit(p)} className="text-blue-600 dark:text-blue-400">
                    <Edit className="mr-2 h-4 w-4" /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDelete(p)} className="text-red-600 dark:text-red-400">
                    <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {p.email && (
              <div className="flex items-center">
                <Mail className="h-4 w-4 mr-2 text-muted-foreground" />
                <span>{p.email}</span>
              </div>
            )}
            {p.phone_number && (
              <div className="flex items-center">
                <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
                <span>{p.phone_number}</span>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default PatientsCardView;