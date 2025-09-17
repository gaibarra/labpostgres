import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiClient } from '@/lib/apiClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import { PlusCircle, Search } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import useUserTable from './user_management/useUserTable';
import UserFormDialog from './user_management/UserFormDialog';
import UsersTable from './user_management/UsersTable';
import DeleteUserDialog from './user_management/DeleteUserDialog';

const UserManagement = () => {
  const { user: authUser, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const isAdmin = useMemo(() => authUser?.profile?.role === 'Administrador', [authUser]);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const { searchTerm, setSearchTerm, sortConfig, requestSort, filteredAndSortedUsers, isDeleting, handleDeleteUser } = useUserTable(users);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const profiles = await apiClient.get('/users');
      setUsers((profiles || []).map(p => ({
        id: p.id,
        email: p.email,
        first_name: p.first_name || '',
        last_name: p.last_name || '',
        display_name: (p.first_name || p.last_name) ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : p.email,
        role: p.role || '',
      })));
    } catch (err) {
      console.error('fetchUsers error:', err);
      toast({ variant: 'destructive', title: 'Error al cargar usuarios', description: err.message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { if (!authLoading) fetchUsers(); }, [authLoading, fetchUsers]);

  const openFormForCreate = () => { setSelectedUser(null); setIsFormOpen(true); };
  const openFormForEdit = (user) => { setSelectedUser(user); setIsFormOpen(true); };
  const openDeleteConfirm = (user) => { setSelectedUser(user); setIsDeleteConfirmOpen(true); };
  // Handle form submission; if editing, update local state, else refetch
  const handleFormSubmit = (updatedUser) => {
    setIsFormOpen(false);
    setSelectedUser(null);
    if (updatedUser && selectedUser) {
      // Update the specific user in local state
      setUsers(prev => prev.map(u => u.id === updatedUser.id
        ? {
            ...u,
            first_name: updatedUser.first_name,
            last_name: updatedUser.last_name,
            display_name: updatedUser.display_name,
            role: updatedUser.role,
          }
        : u
      ));
    } else {
      // For creation or missing data, refetch all users
      fetchUsers();
    }
  };
  const handleDeleteConfirm = async () => {
    if (!selectedUser) return;
    await handleDeleteUser(selectedUser.id);
    setIsDeleteConfirmOpen(false);
    setSelectedUser(null);
    fetchUsers();
  };

  return (
    <div className="p-6 bg-slate-50 dark:bg-slate-900 min-h-screen">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-slate-800 dark:text-white">Gestión de Usuarios</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">Crea, edita y administra los usuarios y sus roles en el sistema.</p>
        </header>

        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
          <div className="relative w-full sm:w-auto flex-grow sm:flex-grow-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input 
              type="text"
              placeholder="Buscar por nombre o rol..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full sm:w-64 md:w-80"
            />
          </div>
          {isAdmin && (
            <Button onClick={openFormForCreate} className="bg-sky-600 hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-600 text-white">
              <PlusCircle className="mr-2 h-5 w-5" />
              Crear Usuario
            </Button>
          )}
        </div>

        <UsersTable
          users={filteredAndSortedUsers}
          onEdit={openFormForEdit}
          onDelete={openDeleteConfirm}
          sortConfig={sortConfig}
          requestSort={requestSort}
          isLoading={loading}
          isAdmin={isAdmin}
        />
      </motion.div>
      
      <UserFormDialog
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
        selectedUser={selectedUser}
        onFormSubmit={handleFormSubmit}
      />
      
      <DeleteUserDialog
        isOpen={isDeleteConfirmOpen}
        onOpenChange={setIsDeleteConfirmOpen}
        selectedUser={selectedUser}
        isDeleting={isDeleting}
        onDeleteConfirm={handleDeleteConfirm}
      />
    </div>
  );
};

export default UserManagement;