import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Edit3, Eye } from 'lucide-react';

const SocialMediaContent = ({ type, data, searchTerm, onSearchTermChange, onOpenForm, onOpenDetails, getIcon, isLoading }) => {
  const filteredData = data.filter(item => {
    if (type === 'posts') {
      return item.platform?.toLowerCase().includes(searchTerm.toLowerCase()) ||
             item.content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
             item.status?.toLowerCase().includes(searchTerm.toLowerCase());
    }
    if (type === 'lists') {
      return item.name.toLowerCase().includes(searchTerm.toLowerCase());
    }
    if (type === 'templates') {
      return item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
             item.subject.toLowerCase().includes(searchTerm.toLowerCase());
    }
    return false;
  }).sort((a, b) => {
    if (type === 'posts') {
      return (b.publish_date_time && a.publish_date_time) ? new Date(b.publish_date_time) - new Date(a.publish_date_time) : 0;
    }
    return (b.created_at && a.created_at) ? new Date(b.created_at) - new Date(a.created_at) : 0;
  });

  const headers = {
    posts: ['Plataforma', 'Fecha/Hora', 'Contenido (Extracto)', 'Tipo', 'Estado', 'Acciones'],
    lists: ['Nombre Lista', 'Suscriptores (Simulado)', 'Acciones'],
    templates: ['Nombre Plantilla', 'Asunto', 'Acciones']
  };

  const renderRow = (item) => {
    switch (type) {
      case 'posts':
        return (
          <TableRow key={item.id}>
            <TableCell className="font-medium">{item.platform}</TableCell>
            <TableCell>{item.publish_date_time ? new Date(item.publish_date_time).toLocaleString('es-MX') : 'N/A'}</TableCell>
            <TableCell className="max-w-xs truncate">{item.content}</TableCell>
            <TableCell>{getIcon(item.content_type)}</TableCell>
            <TableCell>
              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                item.status === 'Publicada' ? 'bg-green-100 text-green-700 dark:bg-green-700/30 dark:text-green-300' :
                item.status === 'Programada' ? 'bg-blue-100 text-blue-700 dark:bg-blue-700/30 dark:text-blue-300' :
                item.status === 'Borrador' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-700/30 dark:text-yellow-300' :
                'bg-gray-100 text-gray-700 dark:bg-gray-700/30 dark:text-gray-300'
              }`}>
                {item.status}
              </span>
            </TableCell>
            <TableCell className="text-right space-x-1">
              <Button variant="outline" size="icon" onClick={() => onOpenDetails(item)} title="Ver Detalles">
                <Eye className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => onOpenForm('edit', item)} title="Editar">
                <Edit3 className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        );
      case 'lists':
        return (
          <TableRow key={item.id}>
            <TableCell>{item.name}</TableCell>
            <TableCell>{item.subscriberCount || 0}</TableCell>
            <TableCell className="text-right">
              <Button variant="outline" size="icon" onClick={() => onOpenForm('edit', item)}>
                <Edit3 className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        );
      case 'templates':
        return (
          <TableRow key={item.id}>
            <TableCell>{item.name}</TableCell>
            <TableCell>{item.subject}</TableCell>
            <TableCell className="text-right">
              <Button variant="outline" size="icon" onClick={() => onOpenForm('edit', item)}>
                <Edit3 className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <Input 
          placeholder={`Buscar ${type}...`} 
          value={searchTerm} 
          onChange={(e) => onSearchTermChange(e.target.value)} 
          className="max-w-sm bg-white dark:bg-theme-davy-dark/50 border-theme-powder dark:border-theme-davy" 
        />
        <Button onClick={() => onOpenForm('new')} className="bg-gradient-to-r from-theme-celestial to-theme-midnight hover:from-theme-celestial-dark hover:to-theme-midnight-dark text-white">
          <PlusCircle className="mr-2 h-4 w-4" /> Nuevo
        </Button>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {headers[type].map((header, index) => (
                <TableHead key={index} className={index === headers[type].length - 1 ? 'text-right' : ''}>{header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={headers[type].length} className="text-center">Cargando...</TableCell></TableRow>
            ) : filteredData.length > 0 ? (
              filteredData.map(item => renderRow(item))
            ) : (
              <TableRow><TableCell colSpan={headers[type].length} className="text-center">No hay datos.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
};

export default SocialMediaContent;