import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Edit3, Trash2, PlusCircle, Users } from 'lucide-react';

const ListsTab = ({
  lists,
  searchTerm,
  setSearchTerm,
  openListForm,
  handleDeleteList,
  openManageSubscribersModal,
}) => {
  const filteredLists = lists.filter(l => l.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <Input 
          placeholder="Buscar listas..." 
          value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)} 
          className="max-w-sm bg-white dark:bg-theme-davy-dark/50 border-theme-powder dark:border-theme-davy" 
        />
        <Button 
          onClick={() => openListForm('new')} 
          className="bg-gradient-to-r from-theme-celestial to-theme-midnight hover:from-theme-celestial-dark hover:to-theme-midnight-dark text-white"
        >
          <PlusCircle className="mr-2 h-4 w-4" /> Nueva Lista
        </Button>
      </div>
      <ScrollArea className="h-[400px] rounded-md border border-theme-powder dark:border-theme-davy">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre Lista</TableHead>
              <TableHead>Suscriptores</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLists.length > 0 ? filteredLists.map(l => (
              <TableRow key={l.id}>
                <TableCell>{l.name}</TableCell>
                <TableCell>{l.subscriberCount}</TableCell>
                <TableCell className="text-right space-x-1">
                   <Button variant="outline" size="icon" onClick={() => openManageSubscribersModal(l)}>
                    <Users className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => openListForm('edit', l)}>
                    <Edit3 className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="text-red-500 hover:text-red-700" onClick={() => handleDeleteList(l.id, l.name)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={3} className="text-center h-24">No se encontraron listas.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ScrollArea>
    </>
  );
};

export default ListsTab;