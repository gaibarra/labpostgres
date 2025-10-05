import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CardHeader, CardTitle } from '@/components/ui/card';
import { Beaker, PlusCircle, Sparkles, Search, HelpCircle } from 'lucide-react';

const StudiesHeader = ({ searchTerm, setSearchTerm, onNewStudyClick, onAIAssist, onHelpClick }) => {
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
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-8 bg-white/80 dark:bg-slate-800/80"
        />
      </div>
    </CardHeader>
  );
};

export default StudiesHeader;