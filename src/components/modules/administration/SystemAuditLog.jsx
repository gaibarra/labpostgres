import React, { useState, useEffect, useCallback } from 'react';
    import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from "@/components/ui/label";
    import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
    import { DatePickerWithRange } from "@/components/ui/datepicker"; 
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
    import { motion } from 'framer-motion';
    import { Activity, ListFilter, Search, Download, Trash2, Eye, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
    import { triggerBlobDownload } from '@/utils/safeDownload';
    import { useToast } from "@/components/ui/use-toast";
    import { ScrollArea } from "@/components/ui/scroll-area";
    import { getFormattedTimestamp } from '@/lib/auditUtils';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
    import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
    import { useDebounce } from 'use-debounce';
  // Supabase eliminado – usar apiClient REST
  import apiClient from '@/lib/apiClient';

    const LOGS_PER_PAGE = 20;

    const actionTypesMap = {
      'Todos': 'Todos',
      'Autenticación': 'Auth',
      'Paciente': 'Patient',
      'Orden': 'Order',
      'Estudio': 'Study',
      'Paquete': 'Package',
      'Referente': 'Referrer',
      'Permisos': 'Permissions',
      'Perfil de Usuario': 'UserProfile',
      'Configuración': 'Settings',
      'Sucursal': 'Branch'
    };
    const actionTypesSpanish = Object.keys(actionTypesMap);

    const SystemAuditLog = () => {
      const { toast } = useToast();
      const [logs, setLogs] = useState([]);
      const [isLoading, setIsLoading] = useState(false);
      const [searchTerm, setSearchTerm] = useState('');
      const [debouncedSearchTerm] = useDebounce(searchTerm, 500);
      const [dateRange, setDateRange] = useState({ from: null, to: null });
      const [selectedUser, setSelectedUser] = useState('');
      const [selectedActionType, setSelectedActionType] = useState('');
      const [users, setUsers] = useState([]);
      const [selectedLogDetails, setSelectedLogDetails] = useState(null);
      const [page, setPage] = useState(0);
      const [totalLogs, setTotalLogs] = useState(0);

      const fetchUsers = useCallback(async () => {
        try {
          const data = await apiClient.get('/users');
          const userList = (data || []).map(u => ({ id: u.id, name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email || u.id }));
          setUsers([{ id: 'Todos', name: 'Todos' }, ...userList]);
        } catch (e) {
          console.error('Error fetching users:', e);
        }
      }, []);
      
      const fetchLogs = useCallback(async () => {
        setIsLoading(true);
        try {
          const params = new URLSearchParams();
          if (debouncedSearchTerm) params.append('search', debouncedSearchTerm);
          if (dateRange.from) params.append('from', dateRange.from.toISOString());
          if (dateRange.to) { const to = new Date(dateRange.to); to.setDate(to.getDate()+1); params.append('to', to.toISOString()); }
          if (selectedUser && selectedUser !== 'Todos') params.append('user', selectedUser);
          const actionPrefix = actionTypesMap[selectedActionType];
          if (actionPrefix && actionPrefix !== 'Todos') params.append('actionPrefix', actionPrefix);
          params.append('page', page);
          params.append('pageSize', LOGS_PER_PAGE);
          const result = await apiClient.get(`/audit?${params.toString()}`);
          setLogs(result.items || []);
          setTotalLogs(result.total || (result.items ? result.items.length : 0));
        } catch (e) {
          console.error(e);
          toast({ title: 'Error al cargar logs', description: e.message, variant: 'destructive' });
          setLogs([]);
        } finally {
          setIsLoading(false);
        }
      }, [toast, debouncedSearchTerm, dateRange, selectedUser, selectedActionType, page]);

      useEffect(() => {
        fetchUsers();
      }, [fetchUsers]);

      useEffect(() => {
        fetchLogs();
      }, [fetchLogs]);


      const handleExportLogs = async () => {
        toast({ title: 'Preparando exportación', description: 'Generando archivo CSV, por favor espere...' });
        try {
          const params = new URLSearchParams();
          if (debouncedSearchTerm) params.append('search', debouncedSearchTerm);
          if (dateRange.from) params.append('from', dateRange.from.toISOString());
          if (dateRange.to) { const toD = new Date(dateRange.to); toD.setDate(toD.getDate()+1); params.append('to', toD.toISOString()); }
          if (selectedUser && selectedUser !== 'Todos') params.append('user', selectedUser);
          const actionPrefix = actionTypesMap[selectedActionType];
          if (actionPrefix && actionPrefix !== 'Todos') params.append('actionPrefix', actionPrefix);
          params.append('all', '1');
          const allLogs = await apiClient.get(`/audit?${params.toString()}`);
          if (!allLogs || !allLogs.items || allLogs.items.length === 0) {
            toast({ title: 'Sin datos', description: 'No hay logs para exportar con los filtros actuales.', variant: 'destructive' });
            return;
          }
          const csvHeader = 'Timestamp,Usuario,Accion,Detalles\n';
          const csvRows = allLogs.items.map(log => {
            const userName = (log.user_name) || 'Sistema';
            const detailsString = typeof log.details === 'object' ? JSON.stringify(log.details).replace(/"/g, '""') : String(log.details).replace(/"/g, '""');
            return `"${getFormattedTimestamp(log.created_at)}","${userName}","${log.action}","${detailsString}"`;
          }).join('\n');
          const blob = new Blob([csvHeader + csvRows], { type: 'text/csv;charset=utf-8;' });
          triggerBlobDownload(blob, `audit_logs_${new Date().toISOString()}.csv`);
          toast({ title: 'Exportación Exitosa', description: 'Logs exportados a CSV.' });
        } catch(e) {
          toast({ title: 'Error de Exportación', description: e.message, variant: 'destructive' });
        }
      };

      const handleClearLogs = async () => {
        try {
          await apiClient.delete('/audit');
          toast({ title: 'Logs Eliminados', description: 'Todos los registros de auditoría han sido eliminados.' });
          setLogs([]); setTotalLogs(0); setPage(0);
        } catch(e){
          toast({ title: 'Error al limpiar', description: `No se pudieron eliminar los logs. ${e.message}`, variant: 'destructive' });
        }
      };

      const totalPages = Math.ceil(totalLogs / LOGS_PER_PAGE);

      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          <Card className="shadow-xl glass-card overflow-hidden">
            <CardHeader className="bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 dark:from-orange-900/70 dark:via-red-900/70 dark:to-pink-900/70 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Activity className="h-10 w-10 mr-4 text-orange-600 dark:text-orange-400" />
                  <div>
                    <CardTitle className="text-3xl font-bold text-orange-700 dark:text-orange-300">
                      Auditoría del Sistema
                    </CardTitle>
                    <CardDescription className="text-slate-600 dark:text-slate-400">
                      Registros de actividad y eventos importantes en la aplicación.
                    </CardDescription>
                  </div>
                </div>
                 <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="bg-red-600 hover:bg-red-700">
                      <Trash2 className="mr-2 h-4 w-4" /> Limpiar Logs
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Estás seguro de eliminar todos los logs?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción no se puede deshacer. Todos los registros de auditoría serán eliminados permanentemente.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleClearLogs} className="bg-red-600 hover:bg-red-700">Eliminar Todos</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <div className="relative">
                  <Label htmlFor="search-audit">Buscar</Label>
                  <Search className="absolute left-3 top-[calc(50%+6px)] -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input 
                    id="search-audit"
                    type="text" 
                    placeholder="En acción, detalles, usuario..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-white dark:bg-slate-700"
                  />
                </div>
                <div>
                  <Label htmlFor="date-range-picker-audit">Rango de Fechas</Label>
                  <DatePickerWithRange id="date-range-picker-audit" date={dateRange} onDateChange={setDateRange} className="w-full bg-white dark:bg-slate-700" />
                </div>
                <div>
                  <Label htmlFor="user-filter-audit">Usuario</Label>
                  <Select value={selectedUser} onValueChange={setSelectedUser}>
                    <SelectTrigger id="user-filter-audit" className="w-full bg-white dark:bg-slate-700"><SelectValue placeholder="Filtrar por usuario" /></SelectTrigger>
                    <SelectContent>
                      {users.map(user => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="action-type-filter-audit">Tipo de Acción</Label>
                  <Select value={selectedActionType} onValueChange={setSelectedActionType}>
                    <SelectTrigger id="action-type-filter-audit" className="w-full bg-white dark:bg-slate-700"><SelectValue placeholder="Filtrar por acción" /></SelectTrigger>
                    <SelectContent>
                      {actionTypesSpanish.map(action => <SelectItem key={action} value={action}>{action}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Acción</TableHead>
                      <TableHead>Detalles</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-8"><Loader2 className="mx-auto h-8 w-8 animate-spin text-sky-600" /></TableCell></TableRow>
                    ) : logs.length > 0 ? logs.map(log => {
                      const displayTimestamp = getFormattedTimestamp(log.created_at || log.created_at_fallback || log.timestamp);
                      const displayUser = (log.user_name && log.user_name.trim()) || 'Sistema';
                      return (
                        <TableRow key={log.id}>
                          <TableCell className="whitespace-nowrap">{displayTimestamp}</TableCell>
                          <TableCell>{displayUser}</TableCell>
                          <TableCell>{log.action}</TableCell>
                          <TableCell>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSelectedLogDetails(log.details)}
                                >
                                  <Eye className="h-4 w-4 mr-1" /> Ver
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-md">
                                <DialogHeader>
                                  <DialogTitle>Detalles del Log</DialogTitle>
                                  <DialogDescription className="space-y-1 text-xs">
                                    <div><strong>ID:</strong> {log.id}</div>
                                    <div><strong>Fecha:</strong> {displayTimestamp}</div>
                                    <div><strong>Usuario:</strong> {displayUser}</div>
                                    {log.performed_by && <div><strong>User ID:</strong> {log.performed_by}</div>}
                                  </DialogDescription>
                                </DialogHeader>
                                <ScrollArea className="max-h-[60vh] mt-4">
                                  <pre className="bg-slate-100 dark:bg-slate-800 p-4 rounded-md text-sm overflow-x-auto">
{typeof selectedLogDetails === 'object' ? JSON.stringify(selectedLogDetails, null, 2) : String(selectedLogDetails)}
                                  </pre>
                                </ScrollArea>
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        </TableRow>
                      );
                    }) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-slate-500 dark:text-slate-400">
                          <ListFilter className="mx-auto h-12 w-12 mb-2 opacity-50" />
                          No hay registros de auditoría que coincidan con los filtros.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                    <Button variant="outline" size="icon" onClick={() => setPage(p => p - 1)} disabled={page === 0}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span>Página {page + 1} de {totalPages > 0 ? totalPages : 1}</span>
                    <Button variant="outline" size="icon" onClick={() => setPage(p => p + 1)} disabled={page + 1 >= totalPages}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Mostrando {logs.length} de {totalLogs} registros.</p>
              <Button onClick={handleExportLogs} className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white">
                <Download className="mr-2 h-4 w-4" /> Exportar Logs (CSV)
              </Button>
            </CardFooter>
          </Card>
        </motion.div>
      );
    };

    export default SystemAuditLog;