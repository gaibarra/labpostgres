import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Edit3, PlusCircle, Trash2 } from 'lucide-react';

const TemplatesTab = ({
  templates,
  searchTerm,
  setSearchTerm,
  openTemplateForm,
  onRequestDelete,
}) => {
  const filteredTemplates = templates.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <Input 
          placeholder="Buscar plantillas..." 
          value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)} 
          className="max-w-sm bg-white dark:bg-theme-davy-dark/50 border-theme-powder dark:border-theme-davy" 
        />
        <Button 
          onClick={() => openTemplateForm('new')} 
          className="bg-gradient-to-r from-theme-celestial to-theme-midnight hover:from-theme-celestial-dark hover:to-theme-midnight-dark text-white"
        >
          <PlusCircle className="mr-2 h-4 w-4" /> Nueva Plantilla
        </Button>
      </div>
      <ScrollArea className="h-[400px] rounded-md border border-theme-powder dark:border-theme-davy">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre Plantilla</TableHead>
              <TableHead>Asunto</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTemplates.length > 0 ? filteredTemplates.map(t => (
              <TableRow key={t.id}>
                <TableCell>{t.name}</TableCell>
                <TableCell>{t.subject}</TableCell>
                <TableCell className="text-right flex gap-2 justify-end">
                  <Button variant="outline" size="icon" onClick={() => openTemplateForm('edit', t)}>
                    <Edit3 className="h-4 w-4" />
                  </Button>
                  <Button variant="destructive" size="icon" onClick={() => onRequestDelete?.(t)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={3} className="text-center h-24">No se encontraron plantillas.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ScrollArea>
    </>
  );
};

export default TemplatesTab;