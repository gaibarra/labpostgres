import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DatePickerWithRange } from '@/components/ui/datepicker';
import SearchableSelect from '@/components/ui/SearchableSelect';
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
          <SearchableSelect
            value={filterBy}
            onValueChange={(value) => { onFilterByChange(value); onFilterEntityIdChange('all'); }}
            options={[{ value: 'all', label: 'Todos' }, { value: 'patient', label: 'Paciente' }, { value: 'referrer', label: 'Referente' }]}
            placeholder="Seleccionar filtro"
            searchPlaceholder="Buscar filtro..."
            emptyText="Sin filtros"
            disabled={isLoading}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {filterBy === 'patient' ? 'Paciente' : (filterBy === 'referrer' ? 'Referente' : 'Entidad')}
          </label>
          <SearchableSelect
            value={filterEntityId}
            onValueChange={onFilterEntityIdChange}
            options={[{ value: 'all', label: 'Todos' }, ...entityOptions.map(e => ({ value: e.id, label: e.nombre }))]}
            placeholder={`Seleccionar ${filterBy}`}
            searchPlaceholder={`Buscar ${filterBy}...`}
            emptyText={`Sin ${filterBy}`}
            disabled={filterBy === 'all' || isLoading || entityOptions.length === 0}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Estado de Pago</label>
          <SearchableSelect
            value={filterStatus}
            onValueChange={onFilterStatusChange}
            options={[{ value: 'all', label: 'Todos' }, { value: 'pending', label: 'Pendientes' }, { value: 'paid', label: 'Pagadas' }]}
            placeholder="Seleccionar estado"
            searchPlaceholder="Buscar estado..."
            emptyText="Sin estados"
            disabled={isLoading}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default ARHeader;