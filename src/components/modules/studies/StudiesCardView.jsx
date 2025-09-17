import React from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Edit3, Trash2, DollarSign, Search as SearchIcon, Tag, MoreVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import EmptyState from '@/components/ui/EmptyState';

const StudiesCardView = ({ studies, onEdit, onDeleteConfirm, onAssignPrices, getParticularPrice }) => {
  if (!studies || studies.length === 0) {
    return (
      <EmptyState 
        icon={SearchIcon}
        title="No se encontraron estudios"
        description="Intenta ajustar tu búsqueda o crea un nuevo estudio para empezar."
      />
    );
  }

  return (
    <AlertDialog>
      <div className="grid grid-cols-1 gap-4 p-4">
        {studies.map((study) => (
          <Card key={study.id} className="bg-card/80 dark:bg-card/70">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="text-lg font-bold text-sky-800 dark:text-sky-300">{study.name}</CardTitle>
                  <p className="text-xs font-mono text-muted-foreground">{study.clave}</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onAssignPrices(study)} className="text-teal-600 dark:text-teal-400">
                      <Tag className="mr-2 h-4 w-4" />
                      <span>Asignar Precios</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEdit(study)} className="text-blue-600 dark:text-blue-400">
                      <Edit3 className="mr-2 h-4 w-4" />
                      <span>Editar</span>
                    </DropdownMenuItem>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem onClick={() => onDeleteConfirm(study)} className="text-red-600 dark:text-red-400">
                        <Trash2 className="mr-2 h-4 w-4" />
                        <span>Eliminar</span>
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <Badge variant="secondary">{study.category}</Badge>
              </div>
              <div className="flex items-center text-sm">
                <DollarSign className="h-4 w-4 mr-1 text-green-600 dark:text-green-400" />
                <span className="font-semibold text-slate-700 dark:text-slate-300">Precio Particular: {getParticularPrice(study.id)}</span>
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">
                <span>Parámetros: </span>
                <span className="font-medium">
                  {study.parameters && study.parameters.length > 0 ? `${study.parameters.length}` : 'N/A'}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AlertDialog>
  );
};

export default StudiesCardView;