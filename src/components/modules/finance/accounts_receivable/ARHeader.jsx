import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DatePickerWithRange } from '@/components/ui/datepicker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter } from 'lucide-react';

const ARHeader = ({ 
  dateRange, 
  onDateChange, 
  filterBy, 
  onFilterByChange, 
  filterEntityId, 
  onFilterEntityIdChange, 
  entityOptions, 
  filterStatus, 
  onFilterStatusChange,
  isLoading
}) => {
  return (
    <Card className="bg-slate-50 dark:bg-slate-800/60 shadow-md">
      <CardHeader>
        <CardTitle className="text-xl flex items-center text-slate-700 dark:text-slate-200">
          <Filter className="h-5 w-5 mr-2 text-sky-500" />
          Filtros de Búsqueda
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Rango de Fechas (Orden)</label>
          <DatePickerWithRange date={dateRange} onDateChange={onDateChange} disabled={isLoading} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Filtrar Por</label>
          <Select value={filterBy} onValueChange={(value) => { onFilterByChange(value); onFilterEntityIdChange('all'); }} disabled={isLoading}>
            <SelectTrigger className="w-full bg-white dark:bg-slate-700"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="patient">Paciente</SelectItem>
              <SelectItem value="referrer">Referente</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {filterBy === 'patient' ? 'Paciente' : (filterBy === 'referrer' ? 'Referente' : 'Entidad')}
          </label>
          <Select value={filterEntityId} onValueChange={onFilterEntityIdChange} disabled={filterBy === 'all' || isLoading || entityOptions.length === 0}>
            <SelectTrigger className="w-full bg-white dark:bg-slate-700"><SelectValue placeholder={`Seleccionar ${filterBy}`} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {entityOptions.map(entity => <SelectItem key={entity.id} value={entity.id}>{entity.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Estado de Pago</label>
          <Select value={filterStatus} onValueChange={onFilterStatusChange} disabled={isLoading}>
            <SelectTrigger className="w-full bg-white dark:bg-slate-700"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendientes</SelectItem>
              <SelectItem value="paid">Pagadas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
};

export default ARHeader;