import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PlusCircle, Search, HelpCircle, Users, ChevronLeft, ChevronRight } from 'lucide-react';

const PatientsHeader = ({ 
  searchTerm, 
  setSearchTerm, 
  onNewPatientClick, 
  onHelpClick,
  currentPage,
  totalCount,
  pageSize,
  onPageChange
}) => {
  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <CardHeader className="p-4 md:p-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center">
            <Users className="h-6 w-6 md:h-8 md:w-8 mr-2 md:mr-3 text-indigo-600 dark:text-indigo-400" />
            <div>
                <CardTitle className="text-xl md:text-2xl font-bold text-indigo-700 dark:text-indigo-400">Gestión de Pacientes</CardTitle>
                <CardDescription>Añade, edita y gestiona la información de tus pacientes.</CardDescription>
            </div>
        </div>
        <div className="flex w-full md:w-auto flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <Button onClick={onNewPatientClick} className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
            <PlusCircle className="mr-2 h-4 w-4" /> Nuevo Paciente
          </Button>
          <Button variant="outline" size="icon" onClick={onHelpClick}>
            <HelpCircle className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="mt-4 flex flex-col md:flex-row items-center gap-4">
        <div className="relative w-full md:flex-grow">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar por nombre, email o teléfono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 bg-white/80 dark:bg-slate-800/80 w-full"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Página {currentPage + 1} de {totalPages}
          </span>
          <Button 
            variant="outline"
            size="icon"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline"
            size="icon"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </CardHeader>
  );
};

export default PatientsHeader;