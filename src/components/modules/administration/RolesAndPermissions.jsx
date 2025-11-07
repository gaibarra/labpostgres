import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { motion } from 'framer-motion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LockKeyhole, Save, AlertTriangle, RefreshCw } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { apiClient } from '@/lib/apiClient';
import { logAuditEvent } from '@/lib/auditUtils';
import { useAuth } from '@/contexts/AuthContext';
import { useAppData } from '@/contexts/AppDataContext';
import { Input } from '@/components/ui/input';

const initialPermissionsConfig = {
  patients: { label: 'Pacientes', actions: ['create', 'read', 'update', 'delete'] },
  referrers: { label: 'Referentes', actions: ['create', 'read', 'update', 'delete', 'manage_pricelists'] },
  studies: { label: 'Estudios', actions: ['create', 'read', 'update', 'delete'] },
  packages: { label: 'Paquetes', actions: ['create', 'read', 'update', 'delete'] },
  orders: { label: 'Órdenes', actions: ['create', 'read_all', 'read_assigned', 'update_status', 'enter_results', 'validate_results', 'print_report', 'send_report'] },
  finance: { label: 'Finanzas', actions: ['access_income_report', 'access_expense_tracking', 'manage_expenses', 'access_accounts_receivable', 'manage_payments', 'access_invoicing'] },
  administration: { label: 'Administración', actions: ['manage_users', 'manage_roles', 'system_settings', 'view_audit_log', 'manage_templates', 'manage_branches'] },
  settings: { label: 'Configuración App', actions: ['access_settings', 'change_theme'] },
  marketing: { label: 'Marketing', actions: ['access_marketing_tools', 'manage_campaigns', 'manage_social_media', 'manage_email_marketing', 'manage_seo_content', 'view_marketing_analytics'] },
};

const actionLabels = {
  create: 'Crear',
  read: 'Ver (todos)',
  read_all: 'Ver Todas',
  read_assigned: 'Ver Asignadas',
  update: 'Actualizar',
  update_status: 'Actualizar Estado',
  enter_results: 'Ingresar Resultados',
  validate_results: 'Validar Resultados',
  print_report: 'Imprimir Reporte',
  send_report: 'Enviar Reporte',
  delete: 'Eliminar',
  manage_pricelists: 'Gestionar Listas de Precios',
  access_income_report: 'Ver Reporte Ingresos',
  access_expense_tracking: 'Ver Control Gastos',
  manage_expenses: 'Gestionar Gastos',
  access_accounts_receivable: 'Ver Cuentas por Cobrar',
  manage_payments: 'Gestionar Pagos',
  access_invoicing: 'Ver Facturación y Recibos',
  manage_users: 'Gestionar Usuarios',
  manage_roles: 'Gestionar Roles',
  system_settings: 'Configuración Sistema',
  view_audit_log: 'Ver Auditoría',
  manage_templates: 'Gestionar Plantillas',
  manage_branches: 'Gestionar Sucursales',
  access_settings: 'Acceder a Configuración',
  change_theme: 'Cambiar Tema',
  access_marketing_tools: 'Ver Herramientas Marketing',
  manage_campaigns: 'Gestionar Campañas Publicidad',
  manage_social_media: 'Gestionar Redes Sociales',
  manage_email_marketing: 'Gestionar Email Marketing',
  manage_seo_content: 'Gestionar SEO y Contenido Web',
  view_marketing_analytics: 'Ver Analíticas Marketing',
};

const RolesAndPermissions = () => {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [rolesPermissions, setRolesPermissions] = useState([]);
  // Use roles table for selector options
  const { roles: roleOptions } = useAppData();
  // const availableRoles = roleOptions.map(r => r.role_name); // not used after refactor
  // Role attributes from roles table
  const { roles, setRoles } = useAppData();
  const [roleLabel, setRoleLabel] = useState('');
  const [roleColorClass, setRoleColorClass] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [currentPermissions, setCurrentPermissions] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const isAdmin = useMemo(() => user?.profile?.role === 'Administrador', [user]);

  // Keep role attributes in sync when role changes
  // Mantener sincronizados label y color asegurando siempre string
  useEffect(() => {
    if (roles && selectedRole) {
      const info = roles.find(r => r.role_name === selectedRole);
      if (info) {
        setRoleLabel(typeof info.label === 'string' ? info.label : '');
        setRoleColorClass(typeof info.color_class === 'string' ? info.color_class : '');
      }
    }
  }, [roles, selectedRole]);

  const loadRolesPermissions = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.get('/roles'); // assuming /roles returns permissions; if separate, adjust
      // If API returns roles separate from permissions map, adapt; here assume array with role_name & permissions
      setRolesPermissions(Array.isArray(data) ? data : []);
      if (data.length > 0) {
        if (!selectedRole || !data.some(r => r.role_name === selectedRole)) {
          setSelectedRole(data[0].role_name);
          setCurrentPermissions(data[0].permissions || {});
        } else {
          const currentRoleData = data.find(r => r.role_name === selectedRole);
          if (currentRoleData) setCurrentPermissions(currentRoleData.permissions || {});
        }
      }
    } catch (error) {
      toast({
        title: "Error al Cargar Roles",
        description: "No se pudieron obtener los roles desde la base de datos.",
        variant: "destructive",
      });
      console.error(error);
      setRolesPermissions([]);
    }
    setIsLoading(false);
  }, [toast, selectedRole]);

  useEffect(() => {
    loadRolesPermissions();
  }, [loadRolesPermissions]);

  useEffect(() => {
    const roleData = rolesPermissions.find(rp => rp.role_name === selectedRole);
    if (roleData) {
      setCurrentPermissions(roleData.permissions || {});
    }
  }, [selectedRole, rolesPermissions]);

  const handleRoleChange = (roleName) => {
    setSelectedRole(roleName);
  };

  const handlePermissionChange = (module, action, checked) => {
    setCurrentPermissions(prev => {
      const updatedModulePermissions = prev[module] ? [...prev[module]] : [];
      if (checked) {
        if (!updatedModulePermissions.includes(action)) {
          updatedModulePermissions.push(action);
        }
      } else {
        const index = updatedModulePermissions.indexOf(action);
        if (index > -1) {
          updatedModulePermissions.splice(index, 1);
        }
      }
      return { ...prev, [module]: updatedModulePermissions };
    });
  };

  // Save role permissions
  const handleSaveChanges = async () => {
    if (!selectedRole) {
      toast({ title: "Error", description: "Seleccione un rol para guardar los cambios.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    
    const selectedRoleData = rolesPermissions.find(rp => rp.role_name === selectedRole);
    if (selectedRoleData?.is_system_role && selectedRoleData.role_name === 'Administrador') {
        toast({ title: "Información", description: "Los permisos del rol Administrador no pueden ser modificados significativamente para asegurar la funcionalidad del sistema.", variant: "default"});
    }

    try {
      await apiClient.put(`/roles/${selectedRole}/permissions`, { permissions: currentPermissions });
      toast({ title: "Permisos Guardados", description: `Los permisos para el rol ${selectedRole} han sido actualizados.` });
      await logAuditEvent('PermissionsUpdated', { role: selectedRole }, user?.id || 'Sistema');
      loadRolesPermissions(); 
    } catch (error) {
      toast({
        title: "Error al Guardar",
        description: `No se pudieron actualizar los permisos. ${error.message}`,
        variant: "destructive",
      });
      await logAuditEvent('PermissionsUpdateFailed', { role: selectedRole, error: error.message }, user?.id || 'Sistema');
    }
    setIsLoading(false);
  };
  
  const selectedRoleDef = rolesPermissions.find(r => r.role_name === selectedRole);
  const isAdminRoleSelected = selectedRoleDef?.role_name === 'Administrador' && selectedRoleDef?.is_system_role;
  
  // Save role attributes (label & color_class)
  const handleSaveRoleAttributes = async () => {
    if (!selectedRole) return;
    try {
  const updated = await apiClient.put(`/roles/${selectedRole}`, { label: roleLabel, color_class: roleColorClass });
  // Update context: assume endpoint returns updated role
  setRoles(prev => prev.map(r => r.role_name === selectedRole ? { ...r, label: updated.label, color_class: updated.color_class } : r));
      toast({ title: 'Atributos de rol guardados', description: `Rol ${selectedRole} actualizado.` });
      await logAuditEvent('RoleAttributesUpdated', { role: selectedRole }, user?.id || 'Sistema');
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error al guardar atributos', description: err.message });
    }
  };

  if (authLoading) {
    return <div>Cargando permisos...</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <Card className="shadow-xl glass-card overflow-hidden">
  <CardHeader className="bg-gradient-to-br from-teal-50 via-cyan-50 to-sky-50 dark:from-teal-900/70 dark:via-cyan-900/70 dark:to-sky-900/70 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <LockKeyhole className="h-10 w-10 mr-4 text-teal-600 dark:text-teal-400" />
              <div>
                <CardTitle className="text-3xl font-bold text-teal-700 dark:text-teal-300">
                  Roles y Permisos
                </CardTitle>
                <CardDescription className="text-slate-600 dark:text-slate-400">
                  Define qué puede hacer cada rol dentro del sistema.
                </CardDescription>
              </div>
            </div>
             <Button onClick={loadRolesPermissions} disabled={isLoading} variant="outline" size="icon" className="bg-white/50 dark:bg-slate-800/50">
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {!isAdmin ? (
            <Card className="bg-yellow-50 dark:bg-yellow-900/30 border-yellow-500 dark:border-yellow-700 p-4 text-center">
              <CardTitle className="text-yellow-700 dark:text-yellow-400">Acceso Restringido</CardTitle>
              <CardDescription className="text-yellow-600 dark:text-yellow-500 mt-2">
                La gestión de roles y permisos está reservada para los Administradores.
              </CardDescription>
            </Card>
          ) : (
            <>
              {/* Role selector */}
              <div className="grid grid-cols-4 items-center gap-4 mb-4">
                <Label htmlFor="role-select" className="text-right">Rol</Label>
                <div className="col-span-3">
                  <SearchableSelect
                    options={roleOptions.map(r => ({ value: r.role_name, label: (r.label && r.label.trim()) ? r.label : r.role_name }))}
                    value={selectedRole}
                    onValueChange={handleRoleChange}
                    placeholder="Selecciona un rol"
                    searchPlaceholder="Buscar rol..."
                    notFoundMessage="Sin roles"
                    disabled={!isAdmin}
                  />
                </div>
              </div>

              {/* Role attributes editor */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="role-label">Etiqueta</Label>
              <Input id="role-label" value={roleLabel || ''} onChange={e => setRoleLabel(e.target.value)} className="col-span-3" disabled={!isAdmin} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="role-color">Clase Color</Label>
              <Input id="role-color" value={roleColorClass || ''} onChange={e => setRoleColorClass(e.target.value)} className="col-span-3" disabled={!isAdmin} />
            </div>
            <div className="mt-4">
              <span className={`${roleColorClass} px-2 py-1 rounded-full text-xs font-semibold`}>{roleLabel || selectedRole}</span>
            </div>
            <div className="mt-4">
              <Button onClick={handleSaveRoleAttributes} disabled={!isAdmin} className="ml-auto">
                <Save className="mr-2 h-4 w-4" /> Guardar Atributos de Rol
              </Button>
            </div>

              {selectedRole && (
                <Card className="bg-slate-50 dark:bg-slate-800/60 shadow-md">
                  <CardHeader>
                    <CardTitle className="text-xl text-slate-700 dark:text-slate-200">Permisos para {selectedRole}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="space-y-4">
                        {Object.entries(initialPermissionsConfig).map(([moduleKey, moduleConfig]) => (
                          <div key={moduleKey}>
                            <h4 className="font-semibold text-md mb-2 text-slate-600 dark:text-slate-300 border-b pb-1 border-slate-300 dark:border-slate-700">{moduleConfig.label}</h4>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2">
                              {moduleConfig.actions.map(actionKey => (
                                <div key={`${moduleKey}-${actionKey}`} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`${moduleKey}-${actionKey}`}
                                    checked={currentPermissions[moduleKey]?.includes(actionKey) || false}
                                    onCheckedChange={(checked) => handlePermissionChange(moduleKey, actionKey, checked)}
                                    disabled={isLoading || isAdminRoleSelected}
                                  />
                                  <Label htmlFor={`${moduleKey}-${actionKey}`} className="text-sm font-normal text-slate-700 dark:text-slate-400">
                                    {actionLabels[actionKey] || actionKey}
                                  </Label>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                  <CardFooter className="flex justify-end pt-4">
                    <Button onClick={handleSaveChanges} disabled={isLoading || isAdminRoleSelected} className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white">
                      <Save className="mr-2 h-4 w-4" /> 
                      {isLoading ? 'Guardando...' : 'Guardar Cambios'}
                    </Button>
                  </CardFooter>
                </Card>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6 bg-amber-50 dark:bg-amber-900/30 border-amber-500 dark:border-amber-700">
        <CardHeader>
          <CardTitle className="text-amber-700 dark:text-amber-400 flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2"/> Nota Importante
          </CardTitle>
        </CardHeader>
        <CardContent className="text-amber-700 dark:text-amber-300 text-sm space-y-2">
           <p>Solo los usuarios con el rol de <strong className="font-semibold">Administrador</strong> pueden gestionar los roles, permisos y usuarios del sistema. Puedes gestionar los usuarios en <Link to="/administration/user-management" className="text-sky-600 dark:text-sky-400 hover:underline">Gestión de Usuarios</Link>.</p>
          <p>La aplicación de estos permisos en cada módulo (restringir acciones basadas en estos settings) <strong>aún no está implementada.</strong> Para una funcionalidad completa, se requiere integrar la lógica de verificación de permisos en cada componente. Puede solicitar esta funcionalidad en su próximo mensaje.</p>
          <p>El rol &quot;Administrador&quot; tiene todos los permisos por defecto y no pueden ser restringidos para asegurar la operatividad del sistema.</p>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default RolesAndPermissions;