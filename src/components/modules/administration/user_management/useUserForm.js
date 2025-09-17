import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import { useToast } from '@/components/ui/use-toast';

const useUserForm = (selectedUser, onFormSubmit) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    role: 'Recepcionista',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (selectedUser) {
      setFormData({
        email: selectedUser.email || '',
        first_name: selectedUser.first_name || '',
        last_name: selectedUser.last_name || '',
        role: selectedUser.role || 'Recepcionista',
        password: '',
      });
    } else {
      setFormData({
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        role: 'Recepcionista',
      });
    }
  }, [selectedUser]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRoleChange = (value) => {
    setFormData(prev => ({ ...prev, role: value }));
  };

  const handleSubmit = async () => {
    // Validación extra: nombre, apellido, rol y contraseña
    if (!formData.first_name.trim() || !formData.last_name.trim()) {
      toast({ variant: 'destructive', title: 'Datos incompletos', description: 'Nombre y Apellido son obligatorios.' });
      return;
    }
    if (!formData.role) {
      toast({ variant: 'destructive', title: 'Rol requerido', description: 'Selecciona un rol válido.' });
      return;
    }
    // En creación, contraseña mínima de 6 caracteres
    if (!selectedUser && (!formData.password || formData.password.length < 6)) {
      toast({ variant: 'destructive', title: 'Contraseña inválida', description: 'La contraseña debe tener al menos 6 caracteres.' });
      return;
    }
    setIsSubmitting(true);
    try {
      let updatedUser = null;
      if (selectedUser) {
        updatedUser = await handleUpdateUser();
      } else {
        await handleCreateUser();
      }
      onFormSubmit(updatedUser);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleCreateUser = async () => {
    try {
      await apiClient.post('/users', formData);
      toast({ title: 'Usuario Creado', description: 'El nuevo usuario ha sido creado exitosamente.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error al Crear Usuario', description: error.message || 'Error desconocido' });
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    try {
      const data = await apiClient.put(`/users/${selectedUser.id}`, {
        first_name: formData.first_name,
        last_name: formData.last_name,
        role: formData.role
      });
      toast({ title: 'Usuario Actualizado', description: 'Los datos del usuario han sido actualizados.' });
      return {
        ...data,
        display_name: (data.first_name || data.last_name) ? `${data.first_name || ''} ${data.last_name || ''}`.trim() : data.email,
      };
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error al Actualizar Usuario', description: error.message });
      return null;
    }
  };

  return {
    formData,
    isSubmitting,
    handleFormChange,
    handleRoleChange,
    handleSubmit,
  };
};

export default useUserForm;