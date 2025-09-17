import React from 'react';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { PlusCircle, Search, HelpCircle } from 'lucide-react';

    const OrdersHeader = ({ 
      searchTerm, 
      setSearchTerm, 
      onNewOrderClick,
      onHelpClick
    }) => {
      return (
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
          <div className="relative w-full md:w-auto flex-grow">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar por folio o paciente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 w-full bg-white/80 dark:bg-slate-800/80"
            />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Button 
              onClick={onNewOrderClick}
              className="bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 text-white flex-grow"
            >
              <PlusCircle className="mr-2 h-4 w-4" /> Nueva Orden
            </Button>
            <Button variant="outline" size="icon" onClick={onHelpClick}>
              <HelpCircle className="h-4 w-4" />
            </Button>
          </div>
        </div>
      );
    };

    export default OrdersHeader;