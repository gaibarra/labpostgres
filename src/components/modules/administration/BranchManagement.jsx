import React, { useState, useEffect, useCallback } from 'react';
    import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Textarea } from '@/components/ui/textarea';
    import { Switch } from '@/components/ui/switch';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
    import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
    import { motion } from 'framer-motion';
    import { Briefcase, PlusCircle, Edit3, Search, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react';
    import { useToast } from "@/components/ui/use-toast";
    import { logAuditEvent } from '@/lib/auditUtils';
    import { ScrollArea } from '@/components/ui/scroll-area';
  // Supabase eliminado – usar apiClient
  import apiClient from '@/lib/apiClient';
    import { useAuth } from '@/contexts/AuthContext';
    
    const initialBranchForm = {
      id: null,
      name: '',
      address: '',
      city: '',
      state: '',
      zip_code: '',
      country: 'México',
      phone: '',
      email: '',
      manager_name: '',
      operating_hours: 'Lunes a Viernes de 8:00 AM a 6:00 PM, Sábados de 9:00 AM a 1:00 PM',
      folio_prefix: '',
      is_active: true,
      is_main: false,
    };
    
    const defaultBranch = {
      name: 'Laboratorio Matriz',
      address: 'Av. Siempre Viva 742',
      city: 'Springfield',
      state: 'Illinois',
      zip_code: '62704',
      country: 'México',
      phone: '555-0100',
      email: 'matriz@milaboratorio.com',
      manager_name: 'Director General',
      operating_hours: 'Lunes a Viernes de 8:00 AM a 6:00 PM, Sábados de 9:00 AM a 1:00 PM',
      folio_prefix: 'MTZ-',
      is_active: true,
      is_main: true,
    };
    
    const BranchManagement = () => {
      const { toast } = useToast();
      const { user } = useAuth();
      const [branches, setBranches] = useState([]);
      const [isLoading, setIsLoading] = useState(false);
      const [isFormOpen, setIsFormOpen] = useState(false);
      const [currentBranch, setCurrentBranch] = useState(initialBranchForm);
      const [formMode, setFormMode] = useState('new');
      const [searchTerm, setSearchTerm] = useState('');
    
      const loadBranches = useCallback(async () => {
        setIsLoading(true);
        try {
          const data = await apiClient.get('/branches');
          if (!data || data.length === 0) {
            await apiClient.post('/branches/seed-default', defaultBranch);
            logAuditEvent('Sistema:SucursalPorDefectoCreada', { name: defaultBranch.name }, 'Sistema');
            const seeded = await apiClient.get('/branches');
            setBranches((seeded || []).map(b => ({ ...initialBranchForm, ...b })));
          } else {
            setBranches(data.map(b => ({ ...initialBranchForm, ...b })));
          }
        } catch (e) {
          console.error(e);
          toast({ title: 'Error', description: 'No se pudieron cargar las sucursales.', variant: 'destructive' });
        } finally {
          setIsLoading(false);
        }
      }, [toast]);
    
      useEffect(() => {
        loadBranches();
      }, [loadBranches]);
    
      const handleSaveBranch = async () => {
        if (!currentBranch.name || !currentBranch.address || !currentBranch.city || !currentBranch.phone) {
          toast({ title: "Error", description: "Nombre, dirección, ciudad y teléfono son obligatorios.", variant: "destructive" });
          return;
        }
    
        setIsLoading(true);
        try {
          const payload = { ...currentBranch };
            if (formMode === 'new') {
              const created = await apiClient.post('/branches', payload);
              logAuditEvent('Administracion:SucursalCreada', { branchId: created.id, name: created.name }, user?.id);
              toast({ title: 'Sucursal Creada', description: `La sucursal "${created.name}" ha sido creada.` });
            } else {
              const updated = await apiClient.put(`/branches/${currentBranch.id}`, payload);
              logAuditEvent('Administracion:SucursalActualizada', { branchId: updated.id, name: updated.name }, user?.id);
              toast({ title: 'Sucursal Actualizada', description: `La sucursal "${updated.name}" ha sido actualizada.` });
            }
            await loadBranches();
            setIsFormOpen(false);
            setCurrentBranch(initialBranchForm);
        } catch(e) {
          console.error(e);
          toast({ title: 'Error al guardar', description: e.message, variant: 'destructive' });
        } finally {
          setIsLoading(false);
        }
      };
    
      const handleInputChange = (field, value) => {
        setCurrentBranch(prev => ({ ...prev, [field]: value }));
      };
    
      const handleSwitchChange = (field, checked) => {
        setCurrentBranch(prev => ({ ...prev, [field]: checked }));
      };
    
      const openForm = (mode = 'new', branch = null) => {
        setFormMode(mode);
        if (mode === 'edit' && branch) {
          setCurrentBranch({ ...initialBranchForm, ...branch });
        } else {
          setCurrentBranch(initialBranchForm);
        }
        setIsFormOpen(true);
      };
    
      const handleToggleActive = async (branch) => {
        if (branch.is_main && branch.is_active) {
          toast({ title: "Acción no permitida", description: "La sucursal Matriz no puede ser desactivada.", variant: "destructive" });
          return;
        }
    
        const newStatus = !branch.is_active;
        try {
          await apiClient.patch(`/branches/${branch.id}`, { is_active: newStatus });
          const statusText = newStatus ? 'activada' : 'desactivada';
          toast({ title: `Sucursal ${statusText}`, description: `La sucursal "${branch.name}" ha sido ${statusText}.` });
          logAuditEvent('Administracion:EstadoSucursalCambiado', { branchId: branch.id, name: branch.name, newStatus: statusText }, user?.id);
          await loadBranches();
        } catch(e) {
          toast({ title: 'Error', description: `No se pudo actualizar el estado: ${e.message}`, variant: 'destructive' });
        }
      };
    
      const filteredBranches = branches.filter(branch =>
        branch.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        branch.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        branch.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        branch.manager_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          <Card className="shadow-xl glass-card overflow-hidden">
            <CardHeader className="bg-gradient-to-br from-purple-50 via-pink-50 to-red-50 dark:from-purple-900/70 dark:via-pink-900/70 dark:to-red-900/70 p-6">
              <div className="flex items-center">
                <Briefcase className="h-10 w-10 mr-4 text-purple-600 dark:text-purple-400" />
                <div>
                  <CardTitle className="text-3xl font-bold text-purple-700 dark:text-purple-300">
                    Gestión de Sucursales
                  </CardTitle>
                  <CardDescription className="text-slate-600 dark:text-slate-400">
                    Administra las diferentes ubicaciones y puntos de servicio de tu laboratorio.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                <div className="relative w-full sm:w-1/3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="Buscar sucursales..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-white dark:bg-slate-700"
                  />
                </div>
                <Button onClick={() => openForm('new')} className="w-full sm:w-auto bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white">
                  <PlusCircle className="mr-2 h-4 w-4" /> Nueva Sucursal
                </Button>
              </div>
    
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Ciudad</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Encargado</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="mx-auto h-8 w-8 animate-spin text-purple-500" /></TableCell></TableRow>
                    ) : filteredBranches.length > 0 ? filteredBranches.map(branch => (
                      <TableRow key={branch.id}>
                        <TableCell className="font-medium">{branch.name} {branch.is_main && <span className="text-xs text-purple-600 dark:text-purple-400 ml-1">(Matriz)</span>}</TableCell>
                        <TableCell>{branch.city}</TableCell>
                        <TableCell>{branch.phone}</TableCell>
                        <TableCell>{branch.manager_name}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${branch.is_active ? 'bg-green-100 text-green-700 dark:bg-green-700/30 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-700/30 dark:text-red-300'}`}>
                            {branch.is_active ? 'Activa' : 'Inactiva'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button variant="outline" size="icon" onClick={() => openForm('edit', branch)} title="Editar Sucursal" className="border-purple-500 text-purple-500 hover:bg-purple-500/10">
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="icon" onClick={() => handleToggleActive(branch)} title={branch.is_active ? "Desactivar Sucursal" : "Activar Sucursal"} className={`border-purple-500 text-purple-500 hover:bg-purple-500/10 ${branch.is_main && branch.is_active ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={branch.is_main && branch.is_active}>
                            {branch.is_active ? <ToggleLeft className="h-4 w-4" /> : <ToggleRight className="h-4 w-4 text-green-500" />}
                          </Button>
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-slate-500 dark:text-slate-400">No se encontraron sucursales.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
    
          <Dialog open={isFormOpen} onOpenChange={(isOpen) => { setIsFormOpen(isOpen); if (!isOpen) setCurrentBranch(initialBranchForm); }}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh]">
              <DialogHeader>
                <DialogTitle className="text-purple-700 dark:text-purple-400 text-xl">
                  {formMode === 'new' ? 'Nueva Sucursal' : `Editar Sucursal: ${currentBranch.name}`}
                </DialogTitle>
                <DialogDescription>
                  {formMode === 'new' ? 'Completa los detalles de la nueva sucursal.' : 'Actualiza la información de la sucursal.'}
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[calc(90vh-200px)] pr-5">
                <div className="grid gap-4 py-4 ">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><Label htmlFor="branchName">Nombre Sucursal</Label><Input id="branchName" value={currentBranch.name} onChange={(e) => handleInputChange('name', e.target.value)} placeholder="Ej: Sucursal Norte"/></div>
                    <div><Label htmlFor="folioPrefix">Prefijo de Folio</Label><Input id="folioPrefix" value={currentBranch.folio_prefix} onChange={(e) => handleInputChange('folio_prefix', e.target.value)} placeholder="Ej: NOR- (opcional)"/></div>
                  </div>
                  <div><Label htmlFor="branchAddress">Dirección Completa</Label><Textarea id="branchAddress" value={currentBranch.address} onChange={(e) => handleInputChange('address', e.target.value)} placeholder="Calle, Número, Colonia"/></div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div><Label htmlFor="branchCity">Ciudad</Label><Input id="branchCity" value={currentBranch.city} onChange={(e) => handleInputChange('city', e.target.value)} /></div>
                    <div><Label htmlFor="branchState">Estado/Provincia</Label><Input id="branchState" value={currentBranch.state} onChange={(e) => handleInputChange('state', e.target.value)} /></div>
                    <div><Label htmlFor="branchZipCode">Código Postal</Label><Input id="branchZipCode" value={currentBranch.zip_code} onChange={(e) => handleInputChange('zip_code', e.target.value)} /></div>
                  </div>
                   <div><Label htmlFor="branchCountry">País</Label><Input id="branchCountry" value={currentBranch.country} onChange={(e) => handleInputChange('country', e.target.value)} /></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><Label htmlFor="branchPhone">Teléfono</Label><Input id="branchPhone" type="tel" value={currentBranch.phone} onChange={(e) => handleInputChange('phone', e.target.value)} /></div>
                    <div><Label htmlFor="branchEmail">Email de Contacto</Label><Input id="branchEmail" type="email" value={currentBranch.email} onChange={(e) => handleInputChange('email', e.target.value)} /></div>
                  </div>
                  <div><Label htmlFor="branchManager">Nombre del Encargado</Label><Input id="branchManager" value={currentBranch.manager_name} onChange={(e) => handleInputChange('manager_name', e.target.value)} /></div>
                  <div><Label htmlFor="branchHours">Horario de Atención</Label><Textarea id="branchHours" value={currentBranch.operating_hours} onChange={(e) => handleInputChange('operating_hours', e.target.value)} placeholder="Ej: L-V 9am-5pm, S 9am-1pm"/></div>
                  <div className="flex items-center space-x-2 pt-2">
                    <Switch id="branchIsActive" checked={currentBranch.is_active} onCheckedChange={(checked) => handleSwitchChange('is_active', checked)} disabled={currentBranch.is_main && formMode === 'edit'}/>
                    <Label htmlFor="branchIsActive">Sucursal Activa</Label>
                  </div>
                  {currentBranch.is_main && formMode === 'edit' && <p className="text-xs text-purple-600 dark:text-purple-400">La sucursal Matriz no puede ser desactivada.</p>}
                </div>
              </ScrollArea>
              <DialogFooter className="pt-4">
                <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                <Button onClick={handleSaveBranch} disabled={isLoading} className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white">
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (formMode === 'new' ? 'Crear Sucursal' : 'Guardar Cambios')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </motion.div>
      );
    };
    
    export default BranchManagement;