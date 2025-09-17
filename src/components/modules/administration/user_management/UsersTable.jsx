import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit, Trash2, ChevronsUpDown, Loader2 } from 'lucide-react';
import RoleBadge from './RoleBadge';

const UsersTable = ({ users, onEdit, onDelete, sortConfig, requestSort, isLoading, isAdmin }) => {

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return <ChevronsUpDown className="ml-2 h-4 w-4 text-slate-400" />;
    }
    return sortConfig.direction === 'ascending' ? '▲' : '▼';
  };

  return (
    <motion.div
      layout
      className="bg-white dark:bg-slate-800 rounded-lg shadow-md overflow-x-auto"
    >
      <Table>
        <TableHeader className="bg-slate-100 dark:bg-slate-700">
          <TableRow>
            <TableHead className="cursor-pointer" onClick={() => requestSort('last_name')}>
              <div className="flex items-center">Nombre {getSortIcon('last_name')}</div>
            </TableHead>
            <TableHead className="hidden md:table-cell cursor-pointer" onClick={() => requestSort('email')}>
              <div className="flex items-center">Email {getSortIcon('email')}</div>
            </TableHead>
            <TableHead className="cursor-pointer" onClick={() => requestSort('role')}>
              <div className="flex items-center">Rol {getSortIcon('role')}</div>
            </TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <AnimatePresence>
            {isLoading ? (
              <TableRow><TableCell colSpan="4" className="text-center py-8"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
            ) : users.length > 0 ? (
              users.map(user => (
                <motion.tr
                  key={user.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="hover:bg-slate-50 dark:hover:bg-slate-700/50"
                >
                  {/* Mostrar email si no hay nombre */}
                  <TableCell className="font-medium">
                    {user.display_name || user.email}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-slate-500 dark:text-slate-400">{user.email || 'No disponible'}</TableCell>
                  <TableCell>
                    <RoleBadge role={user.role} />
                  </TableCell>
                  <TableCell className="text-right">
                    {isAdmin && user.id !== '00000000-0000-0000-0000-000000000000' && ( // Placeholder check if needed
                      <>
                        <Button variant="ghost" size="icon" onClick={() => onEdit(user)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => onDelete(user)} className="text-red-500 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </TableCell>
                </motion.tr>
              ))
            ) : (
              <TableRow><TableCell colSpan="4" className="text-center py-8">No se encontraron usuarios.</TableCell></TableRow>
            )}
          </AnimatePresence>
        </TableBody>
      </Table>
    </motion.div>
  );
};

export default UsersTable;