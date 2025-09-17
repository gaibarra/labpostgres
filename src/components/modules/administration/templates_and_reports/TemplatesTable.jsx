import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Copy, Edit3, Trash2, Eye } from 'lucide-react';
import { motion } from 'framer-motion';

const TemplatesTable = ({
  templates,
  isLoading,
  handleSetDefault,
  openForm,
  handleDeleteTemplate,
  openPreview
}) => {

  if (templates.length === 0) {
    return (
      <p className="text-center text-slate-500 dark:text-slate-400 py-8">
        No hay plantillas para esta categoría.
      </p>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Predeterminada</TableHead>
            <TableHead>Sistema</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {templates.map(template => (
            <TableRow key={template.id}>
              <TableCell className="font-medium">{template.name}</TableCell>
              <TableCell>
                <Input
                  type="checkbox"
                  checked={template.is_default}
                  onChange={() => handleSetDefault(template.id, template.type)}
                  className="h-5 w-5"
                  disabled={template.is_default || isLoading}
                />
              </TableCell>
              <TableCell>{template.is_system ? 'Sí' : 'No'}</TableCell>
              <TableCell className="text-right space-x-1">
                <Button variant="ghost" size="icon" onClick={() => openPreview(template)} title="Previsualizar">
                  <Eye className="h-4 w-4 text-green-500" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => openForm('clone', template)} title="Clonar">
                  <Copy className="h-4 w-4 text-blue-500" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => openForm('edit', template)} title="Editar">
                  <Edit3 className="h-4 w-4 text-yellow-500" />
                </Button>
                {!template.is_system && !template.is_default && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" title="Eliminar">
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Confirmar Eliminación</DialogTitle>
                        <DialogDescription>
                          ¿Estás seguro de que quieres eliminar la plantilla "{template.name}"? Esta acción no se puede deshacer.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                        <Button variant="destructive" onClick={() => handleDeleteTemplate(template.id, template.name)}>Eliminar</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </motion.div>
  );
};

export default TemplatesTable;