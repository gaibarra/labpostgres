import { useState, useMemo, useCallback } from 'react';
import { apiClient } from '@/lib/apiClient';
import { useToast } from '@/components/ui/use-toast';

const useUserTable = (users) => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'last_name', direction: 'ascending' });
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredAndSortedUsers = useMemo(() => {
    return users
      .filter(user =>
        (user.first_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (user.last_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (user.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (user.role?.toLowerCase() || '').includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => {
        if (!a[sortConfig.key] || a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (!b[sortConfig.key] || a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
  }, [users, searchTerm, sortConfig]);

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const handleDeleteUser = useCallback(async (userId) => {
    setIsDeleting(true);
    try {
      await apiClient.delete(`/users/${userId}`);
      toast({ title: 'Usuario Eliminado', description: 'El usuario ha sido eliminado correctamente.' });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al Eliminar Usuario",
        description: `No se pudo eliminar el usuario: ${error.message}. Es posible que necesite eliminar datos relacionados primero.`,
      });
    } finally {
      setIsDeleting(false);
    }
    return true; // Indicate completion
  }, [toast]);

  return {
    searchTerm,
    setSearchTerm,
    sortConfig,
    requestSort,
    filteredAndSortedUsers,
    isDeleting,
    handleDeleteUser,
  };
};

export default useUserTable;