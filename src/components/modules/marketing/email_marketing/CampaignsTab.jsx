import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Eye, Edit3, PlusCircle } from 'lucide-react';
import { format } from 'date-fns';

const CampaignsTab = ({
  campaigns,
  searchTerm,
  setSearchTerm,
  openCampaignForm,
  handleViewCampaignDetails,
}) => {
  const filteredCampaigns = campaigns.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <Input 
          placeholder="Buscar campañas..." 
          value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)} 
          className="max-w-sm bg-white dark:bg-theme-davy-dark/50 border-theme-powder dark:border-theme-davy" 
        />
        <Button 
          onClick={() => openCampaignForm('new')} 
          className="bg-gradient-to-r from-theme-celestial to-theme-midnight hover:from-theme-celestial-dark hover:to-theme-midnight-dark text-white"
        >
          <PlusCircle className="mr-2 h-4 w-4" /> Nueva Campaña
        </Button>
      </div>
      <ScrollArea className="h-[400px] rounded-md border border-theme-powder dark:border-theme-davy">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Asunto</TableHead>
              <TableHead>Fecha Envío</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCampaigns.length > 0 ? filteredCampaigns.map(c => (
              <TableRow key={c.id}>
                <TableCell>{c.name}</TableCell>
                <TableCell>{c.subject}</TableCell>
                <TableCell>{c.sendDateTime ? format(c.sendDateTime, 'dd/MM/yy HH:mm') : 'N/A'}</TableCell>
                <TableCell>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${ c.status === 'Enviada' ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' : c.status === 'Programada' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300'}`}>
                    {c.status}
                  </span>
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="outline" size="icon" onClick={() => handleViewCampaignDetails(c)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => openCampaignForm('edit', c)}>
                    <Edit3 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24">No se encontraron campañas.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ScrollArea>
    </>
  );
};

export default CampaignsTab;