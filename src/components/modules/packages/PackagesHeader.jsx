import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PlusCircle, Search, HelpCircle, Package } from 'lucide-react';

const PackagesHeader = ({ searchTerm, setSearchTerm, onNewPackageClick, onHelpClick, isSubmitting }) => {
  return (
    <CardHeader className="p-4 md:p-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center">
          <Package className="h-8 w-8 mr-3 text-sky-600 dark:text-sky-400" />
          <div>
            <CardTitle className="text-xl md:text-2xl font-bold text-sky-700 dark:text-sky-400">Gestión de Paquetes</CardTitle>
            <CardDescription>Crea, edita y gestiona tus paquetes de estudios.</CardDescription>
          </div>
        </div>
        <div className="flex w-full md:w-auto flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <Button onClick={onNewPackageClick} className="bg-gradient-to-r from-sky-500 to-cyan-500 text-white" disabled={isSubmitting}>
            <PlusCircle className="mr-2 h-4 w-4" /> Nuevo Paquete
          </Button>
          <Button variant="outline" size="icon" onClick={onHelpClick} disabled={isSubmitting}>
            <HelpCircle className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="mt-4 relative w-full">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Buscar por nombre..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-8 bg-white/80 dark:bg-slate-800/80"
          disabled={isSubmitting}
        />
      </div>
    </CardHeader>
  );
};

export default PackagesHeader;