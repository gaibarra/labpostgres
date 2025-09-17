import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useAppData } from '@/contexts/AppDataContext';
import useUserForm from './useUserForm';

const UserFormDialog = ({ isOpen, onOpenChange, selectedUser, onFormSubmit }) => {
  const appData = useAppData();
  const roles = appData ? appData.roles : [];
  const {
    formData,
    isSubmitting,
    handleFormChange,
    handleRoleChange,
    handleSubmit,
  } = useUserForm(selectedUser, onFormSubmit);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-2xl">{selectedUser ? 'Editar Usuario' : 'Crear Nuevo Usuario'}</DialogTitle>
          <DialogDescription>
            {selectedUser ? 'Modifica los detalles del usuario.' : 'Completa el formulario para crear un nuevo usuario.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Email siempre visible; deshabilitado en edición */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="email" className="text-right">Email</Label>
            <Input
              id="email"
              name="email"
              value={formData.email}
              onChange={handleFormChange}
              className="col-span-3"
              type="email"
              disabled={isSubmitting || !!selectedUser}
            />
          </div>
          {!selectedUser && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="password" className="text-right">Contraseña</Label>
              <Input
                id="password"
                name="password"
                value={formData.password}
                onChange={handleFormChange}
                className="col-span-3"
                type="password"
                disabled={isSubmitting}
              />
            </div>
          )}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="first_name" className="text-right">Nombre</Label>
            <Input id="first_name" name="first_name" value={formData.first_name} onChange={handleFormChange} className="col-span-3" disabled={isSubmitting} />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="last_name" className="text-right">Apellido</Label>
            <Input id="last_name" name="last_name" value={formData.last_name} onChange={handleFormChange} className="col-span-3" disabled={isSubmitting} />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="role" className="text-right">Rol</Label>
            <Select onValueChange={handleRoleChange} value={formData.role} disabled={isSubmitting}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder={roles && roles.length > 0 ? "Selecciona un rol" : "Cargando roles..."} />
              </SelectTrigger>
              <SelectContent>
                {roles.map(({ role_name, label }) => (
                  <SelectItem key={role_name} value={role_name}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isSubmitting}>Cancelar</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {selectedUser ? 'Guardar Cambios' : 'Crear Usuario'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UserFormDialog;