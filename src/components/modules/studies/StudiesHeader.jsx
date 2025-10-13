import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CardHeader, CardTitle } from '@/components/ui/card';
import { Beaker, PlusCircle, Sparkles, Search, HelpCircle, ChevronLeft, ChevronRight } from 'lucide-react';

// Props extended to support pagination controls
const StudiesHeader = ({
  searchTerm,
  setSearchTerm,
  onNewStudyClick,
  onAIAssist,
  onHelpClick,
  onSearch,
  currentPage = 0,
  totalCount = 0,
  pageSize = 50,
  totalStudiesPages = 0,
  onPageChange,
  onPageSizeChange
}) => {
  const canPrev = currentPage > 0;
  const canNext = totalStudiesPages ? (currentPage < totalStudiesPages - 1) : ((currentPage + 1) * pageSize < totalCount);
  const showingFrom = totalCount === 0 ? 0 : (currentPage * pageSize + 1);
  const showingTo = Math.min((currentPage + 1) * pageSize, totalCount || 0);

  return (
    <CardHeader className="p-4 md:p-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center">
          <Beaker className="h-6 w-6 md:h-8 md:w-8 mr-2 md:mr-3 text-sky-600 dark:text-sky-400" />
          <CardTitle className="text-xl md:text-2xl font-bold text-sky-700 dark:text-sky-400">Catálogo de Estudios</CardTitle>
        </div>
        <div className="flex w-full md:w-auto flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <Button className="bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 text-white" onClick={onNewStudyClick}>
            <PlusCircle className="mr-2 h-4 w-4" /> Nuevo Estudio
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onAIAssist} className="flex-1 text-purple-500 border-purple-500 hover:bg-purple-100 dark:hover:bg-purple-800">
              <Sparkles className="mr-2 h-4 w-4" /> Asistencia IA
            </Button>
            <Button variant="outline" size="icon" onClick={onHelpClick}>
              <HelpCircle className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      <div className="mt-4 relative w-full">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Buscar estudio..."
          value={searchTerm}
          onChange={(e) => {
            const v = e.target.value;
            setSearchTerm(v);
            // Reset to first page on new search and optionally trigger external search handler
            if (onPageChange) onPageChange(0);
            if (onSearch) onSearch(v);
          }}
          className="pl-8 bg-white/80 dark:bg-slate-800/80"
        />
      </div>
      <div className="mt-3 flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
        <div className="flex items-center gap-3">
          {totalCount > 0 ? (
            <span>Mostrando {showingFrom} - {showingTo} de {totalCount}</span>
          ) : (
            <span>No hay estudios</span>
          )}
          <div className="flex items-center gap-1">
            <span className="whitespace-nowrap">por página:</span>
            <select
              className="border rounded px-2 py-1 bg-white/80 dark:bg-slate-800/80"
              value={pageSize}
              onChange={(e)=>{ const v = parseInt(e.target.value,10)||50; onPageSizeChange && onPageSizeChange(v); if (onPageChange) onPageChange(0);} }
            >
              {[50,100,200,500].map(opt => (<option key={opt} value={opt}>{opt}</option>))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange && onPageChange(currentPage - 1)}
            disabled={!canPrev}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[120px] text-center">
            Página {totalStudiesPages ? (currentPage + 1) : (Math.floor(showingTo / (pageSize || 1)) || 1)} de {totalStudiesPages || Math.max(1, Math.ceil((totalCount || 0) / (pageSize || 1)))}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange && onPageChange(currentPage + 1)}
            disabled={!canNext}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </CardHeader>
  );
};

export default StudiesHeader;