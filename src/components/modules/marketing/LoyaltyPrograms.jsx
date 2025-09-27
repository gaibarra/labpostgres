dimport React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from 'framer-motion';
import { Award, PlusCircle, Edit3, Search, Users, Settings, Star, Trash2, Info, Loader2 } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { logAuditEvent } from '@/lib/auditUtils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DatePicker } from '@/components/ui/datepicker'; 
import { format, parseISO } from 'date-fns';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';

const initialProgramForm = { id: null, name: '', type: 'Puntos', description: '', rules: '', start_date: null, end_date: null, status: 'Borrador', levels: [] };
const initialLevelForm = { id: null, name: '', points_required: '', rewards_desc: '' };
const programTypes = ['Puntos', 'Descuentos Directos', 'Beneficios Exclusivos', 'Niveles de Membresía'];
const programStatuses = ['Borrador', 'Activo', 'Inactivo', 'Finalizado', 'Archivado'];

const LoyaltyPrograms = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('programs');
  
  const [programs, setPrograms] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const [isProgramFormOpen, setIsProgramFormOpen] = useState(false);
  const [currentProgram, setCurrentProgram] = useState(initialProgramForm);
  const [programFormMode, setProgramFormMode] = useState('new');

  const [isLevelFormOpen, setIsLevelFormOpen] = useState(false);
  const [currentLevel, setCurrentLevel] = useState(initialLevelForm);
  const [levelFormMode, setLevelFormMode] = useState('new');
  const [editingProgramIdForLevel, setEditingProgramIdForLevel] = useState(null);
  
  const [searchTerm, setSearchTerm] = useState('');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [programsRes, participantsRes] = await Promise.all([
        apiClient.get('/marketing/loyalty/programs'),
        apiClient.get('/marketing/loyalty/participants')
      ]);
      setPrograms(programsRes.map(p => ({
        ...p,
        start_date: p.start_date ? parseISO(p.start_date) : null,
        end_date: p.end_date ? parseISO(p.end_date) : null
      })));
      setParticipants(participantsRes);
    } catch (error) {
      toast({ title: 'Error', description: `No se pudieron cargar los datos de lealtad: ${error.message}`, variant: 'destructive' });
    } finally { setIsLoading(false); }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSaveProgram = async () => {
    if (!currentProgram.name || !currentProgram.type) {
      toast({ title: "Error", description: "Nombre y tipo de programa son obligatorios.", variant: "destructive" });
      return;
    }
    
    setIsLoading(true);
    const programData = {
      ...currentProgram,
      start_date: currentProgram.start_date ? format(currentProgram.start_date, "yyyy-MM-dd") : null,
      end_date: currentProgram.end_date ? format(currentProgram.end_date, "yyyy-MM-dd") : null,
      user_id: user.id
    };
    delete programData.id;
    delete programData.levels; // Levels are managed separately

    try {
      if (programFormMode === 'new') {
        await apiClient.post('/marketing/loyalty/programs', programData);
        await logAuditEvent('Marketing:ProgramaLealtadCreado', { name: programData.name });
        toast({ title: 'Programa de Lealtad Creado' });
      } else {
        await apiClient.put(`/marketing/loyalty/programs/${currentProgram.id}`, programData);
        await logAuditEvent('Marketing:ProgramaLealtadActualizado', { programId: currentProgram.id, name: programData.name });
        toast({ title: 'Programa de Lealtad Actualizado' });
      }
      loadData();
      setIsProgramFormOpen(false);
      setCurrentProgram(initialProgramForm);
    } catch (error) {
      toast({ title: 'Error al guardar programa', description: error.message, variant: 'destructive' });
    } finally { setIsLoading(false); }
  };

  const handleSaveLevel = async () => {
     if (!currentLevel.name || !currentLevel.rewards_desc) {
      toast({ title: "Error", description: "Nombre del nivel y descripción de recompensas son obligatorios.", variant: "destructive" });
      return;
    }
    const programForLevel = programs.find(p => p.id === editingProgramIdForLevel);
    if(programForLevel?.type === 'Puntos' && !currentLevel.points_required){
        toast({ title: "Error", description: "Puntos requeridos es obligatorio.", variant: "destructive" });
        return;
    }
    
    setIsLoading(true);
    const levelData = {
      ...currentLevel,
      program_id: editingProgramIdForLevel,
      user_id: user.id,
      points_required: currentLevel.points_required ? parseInt(currentLevel.points_required, 10) : null,
    };
    delete levelData.id;

    try {
      if (levelFormMode === 'new') {
        await apiClient.post(`/marketing/loyalty/programs/${editingProgramIdForLevel}/levels`, levelData);
        await logAuditEvent('Marketing:NivelLealtadCreado', { programId: editingProgramIdForLevel, name: levelData.name });
        toast({ title: 'Nivel de Lealtad Creado' });
      } else {
        await apiClient.put(`/marketing/loyalty/levels/${currentLevel.id}`, levelData);
        await logAuditEvent('Marketing:NivelLealtadActualizado', { levelId: currentLevel.id, name: levelData.name });
        toast({ title: 'Nivel de Lealtad Actualizado' });
      }
      loadData();
      setIsLevelFormOpen(false);
      setCurrentLevel(initialLevelForm);
      setEditingProgramIdForLevel(null);
    } catch (error) {
      toast({ title: 'Error al guardar nivel', description: error.message, variant: "destructive" });
    } finally { setIsLoading(false); }
  };
  
  const openProgramForm = (mode = 'new', program = null) => {
    setProgramFormMode(mode);
    setCurrentProgram(mode === 'edit' && program ? program : initialProgramForm);
    setIsProgramFormOpen(true);
  };

  const openLevelForm = (mode = 'new', level = null, programId) => {
    setLevelFormMode(mode);
    setCurrentLevel(mode === 'edit' && level ? level : initialLevelForm);
    setEditingProgramIdForLevel(programId);
    setIsLevelFormOpen(true);
  };

  const handleDeleteLevel = async (levelId) => {
    if(!window.confirm('¿Estás seguro de que quieres eliminar este nivel?')) return;
    setIsLoading(true);
    try {
      await apiClient.delete(`/marketing/loyalty/levels/${levelId}`);
      await logAuditEvent('Marketing:NivelLealtadEliminado', { levelId });
      toast({ title: 'Nivel Eliminado', variant: 'destructive' });
      loadData();
    } catch (error) {
      toast({ title: 'Error al eliminar nivel', description: error.message, variant: 'destructive' });
    } finally { setIsLoading(false); }
  };

  const filteredPrograms = programs.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.type.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredParticipants = participants.filter(p => p.participant_name?.toLowerCase().includes(searchTerm.toLowerCase()));

  const renderContentForTab = () => {
    switch (activeTab) {
      case 'programs':
        return (
          <>
            <div className="flex justify-between items-center mb-4">
              <Input placeholder="Buscar programas..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-sm bg-white dark:bg-theme-davy-dark/50 border-theme-powder dark:border-theme-davy" />
              <Button onClick={() => openProgramForm('new')} className="bg-gradient-to-r from-theme-celestial to-theme-midnight hover:from-theme-celestial-dark hover:to-theme-midnight-dark text-white"><PlusCircle className="mr-2 h-4 w-4" /> Nuevo Programa</Button>
            </div>
            <ScrollArea className="h-[400px] rounded-md border border-theme-powder dark:border-theme-davy">
              <Table>
                <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Tipo</TableHead><TableHead>Duración</TableHead><TableHead>Niveles</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                  ) : filteredPrograms.length > 0 ? filteredPrograms.map(p => (
                    <TableRow key={p.id}>
                      <TableCell>{p.name}</TableCell><TableCell>{p.type}</TableCell>
                      <TableCell>{p.start_date ? format(p.start_date, 'dd/MM/yy') : 'N/A'} - {p.end_date ? format(p.end_date, 'dd/MM/yy') : 'Indefinido'}</TableCell>
                      <TableCell>{p.levels?.length || 0}</TableCell>
                      <TableCell><span className={`px-2 py-1 text-xs font-semibold rounded-full ${ p.status === 'Activo' ? 'bg-green-100 text-green-700' : p.status === 'Borrador' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'}`}>{p.status}</span></TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="outline" size="icon" onClick={() => openLevelForm('new', null, p.id)} title="Añadir Nivel"><Star className="h-4 w-4"/></Button>
                        <Button variant="outline" size="icon" onClick={() => openProgramForm('edit', p)}><Edit3 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  )) : <TableRow><TableCell colSpan={6} className="text-center">No hay programas de lealtad.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </ScrollArea>
          </>
        );
      case 'participants':
        return (
          <>
            <div className="flex justify-between items-center mb-4">
              <Input placeholder="Buscar participantes..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-sm bg-white dark:bg-theme-davy-dark/50 border-theme-powder dark:border-theme-davy" />
              <Button onClick={() => toast({title: "🚧 Próximamente", description: "La gestión manual de participantes estará disponible pronto."})} className="bg-gradient-to-r from-theme-celestial to-theme-midnight hover:from-theme-celestial-dark hover:to-theme-midnight-dark text-white"><PlusCircle className="mr-2 h-4 w-4" /> Añadir Participante</Button>
            </div>
            <ScrollArea className="h-[400px] rounded-md border border-theme-powder dark:border-theme-davy">
              <Table>
                <TableHeader><TableRow><TableHead>Nombre Participante</TableHead><TableHead>Programa</TableHead><TableHead>Nivel Actual</TableHead><TableHead>Puntos</TableHead><TableHead>Fecha Unión</TableHead></TableRow></TableHeader>
                <TableBody>
                   {isLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                  ) : filteredParticipants.length > 0 ? filteredParticipants.map(p => (
                    <TableRow key={p.id}>
                      <TableCell>{p.participant_name}</TableCell>
                      <TableCell>{p.program?.name || 'N/A'}</TableCell>
                      <TableCell>{p.level?.name || 'N/A'}</TableCell><TableCell>{p.points}</TableCell>
                      <TableCell>{p.join_date ? format(parseISO(p.join_date), 'dd/MM/yy') : 'N/A'}</TableCell>
                    </TableRow>
                  )) : <TableRow><TableCell colSpan={5} className="text-center">No hay participantes registrados.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </ScrollArea>
             <Card className="mt-4 bg-blue-50 dark:bg-blue-900/30 border-blue-500 dark:border-blue-700">
                <CardHeader><CardTitle className="text-blue-700 dark:text-blue-400 flex items-center"><Info className="h-5 w-5 mr-2"/>Nota sobre Participantes</CardTitle></CardHeader>
                <CardContent className="text-blue-700 dark:text-blue-300 text-sm">
                    La lista de participantes se alimenta de datos reales. La integración con Pacientes y Referentes para añadir participantes automáticamente se implementará en futuras actualizaciones.
                </CardContent>
            </Card>
          </>
        );
      default: return null;
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="space-y-6">
      <Card className="shadow-xl glass-card overflow-hidden">
        <CardHeader className="bg-gradient-to-br from-theme-celestial/20 via-theme-powder/20 to-theme-periwinkle/20 dark:from-theme-celestial/30 dark:via-theme-powder/30 dark:to-theme-periwinkle/30 p-6">
          <div className="flex items-center">
            <Award className="h-10 w-10 mr-4 text-theme-celestial dark:text-theme-celestial-light" />
            <div>
              <CardTitle className="text-3xl font-bold text-theme-midnight dark:text-theme-powder">Programas de Lealtad</CardTitle>
              <CardDescription className="text-theme-davy dark:text-theme-powder/80">Fideliza a tus pacientes y referentes con programas de recompensas.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <Tabs value={activeTab} onValueChange={(newTab) => { setActiveTab(newTab); setSearchTerm(''); }} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="programs" className="flex items-center gap-2"><Settings className="h-4 w-4"/>Programas y Niveles</TabsTrigger>
              <TabsTrigger value="participants" className="flex items-center gap-2"><Users className="h-4 w-4"/>Participantes</TabsTrigger>
            </TabsList>
            <TabsContent value="programs">{renderContentForTab()}</TabsContent>
            <TabsContent value="participants">{renderContentForTab()}</TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={isProgramFormOpen} onOpenChange={(isOpen) => { setIsProgramFormOpen(isOpen); if (!isOpen) setCurrentProgram(initialProgramForm); }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{programFormMode === 'new' ? 'Nuevo Programa de Lealtad' : 'Editar Programa'}</DialogTitle>
            <DialogDescription className="sr-only">
              Formulario para {programFormMode === 'new' ? 'crear un nuevo' : 'editar un'} programa de lealtad incluyendo nombre, tipo, fechas, estado y niveles.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(90vh-250px)] pr-5">
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label htmlFor="progName">Nombre Programa</Label><Input id="progName" value={currentProgram.name} onChange={(e) => setCurrentProgram({...currentProgram, name: e.target.value})} /></div>
                <div>
                  <Label htmlFor="progType">Tipo de Programa</Label>
                  <Select value={currentProgram.type} onValueChange={(val) => setCurrentProgram({...currentProgram, type: val})}>
                    <SelectTrigger id="progType"><SelectValue/></SelectTrigger>
                    <SelectContent>{programTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label htmlFor="progDesc">Descripción</Label><Textarea id="progDesc" value={currentProgram.description} onChange={(e) => setCurrentProgram({...currentProgram, description: e.target.value})} /></div>
              <div><Label htmlFor="progRules">Reglas (Cómo ganar)</Label><Textarea id="progRules" value={currentProgram.rules} onChange={(e) => setCurrentProgram({...currentProgram, rules: e.target.value})} /></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label htmlFor="progStartDate">Fecha Inicio</Label><DatePicker date={currentProgram.start_date} setDate={(date) => setCurrentProgram({...currentProgram, start_date: date})} buttonClassName="w-full"/></div>
                <div><Label htmlFor="progEndDate">Fecha Fin (Opcional)</Label><DatePicker date={currentProgram.end_date} setDate={(date) => setCurrentProgram({...currentProgram, end_date: date})} buttonClassName="w-full"/></div>
              </div>
              <div>
                <Label htmlFor="progStatus">Estado</Label>
                <Select value={currentProgram.status} onValueChange={(val) => setCurrentProgram({...currentProgram, status: val})}>
                  <SelectTrigger id="progStatus"><SelectValue/></SelectTrigger>
                  <SelectContent>{programStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              
              <div className="mt-4 border-t pt-4">
                <div className="flex justify-between items-center mb-2">
                    <h4 className="text-lg font-semibold">Niveles del Programa</h4>
                </div>
                {currentProgram.id && (
                  <div className="space-y-2">
                    {currentProgram.levels && currentProgram.levels.length > 0 ? currentProgram.levels.map(level => (
                        <Card key={level.id} className="bg-slate-50 dark:bg-slate-800/50 p-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-semibold">{level.name}</p>
                                    {currentProgram.type === 'Puntos' && <p className="text-xs">Puntos Requeridos: {level.points_required}</p>}
                                    <p className="text-xs text-slate-600 dark:text-slate-400">Recompensas: {level.rewards_desc}</p>
                                </div>
                                <div className="space-x-1">
                                    <Button variant="ghost" size="icon" onClick={() => openLevelForm('edit', level, currentProgram.id)}><Edit3 className="h-4 w-4"/></Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteLevel(level.id)} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4"/></Button>
                                </div>
                            </div>
                        </Card>
                    )) : <p className="text-sm text-slate-500 dark:text-slate-400">Aún no hay niveles. Guárdalo y luego añádelos desde la tabla principal.</p>}
                  </div>
                )}
                {!currentProgram.id && <p className="text-sm text-slate-500 dark:text-slate-400">Guarda el programa primero para poder añadir niveles.</p>}
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="pt-4 border-t">
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={handleSaveProgram} disabled={isLoading}>{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Guardar Programa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isLevelFormOpen} onOpenChange={(isOpen) => { setIsLevelFormOpen(isOpen); if (!isOpen) { setCurrentLevel(initialLevelForm); setEditingProgramIdForLevel(null); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{levelFormMode === 'new' ? 'Nuevo Nivel de Lealtad' : 'Editar Nivel'}</DialogTitle>
            <DialogDescription className="sr-only">
              Formulario para {levelFormMode === 'new' ? 'crear un nuevo' : 'editar un'} nivel de un programa de lealtad, incluyendo nombre, puntos requeridos y recompensas.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div><Label htmlFor="levelName">Nombre Nivel</Label><Input id="levelName" value={currentLevel.name} onChange={(e) => setCurrentLevel({...currentLevel, name: e.target.value})} /></div>
            {(programs.find(p => p.id === editingProgramIdForLevel)?.type === 'Puntos') && (
              <div><Label htmlFor="levelPoints">Puntos Requeridos</Label><Input id="levelPoints" type="number" value={currentLevel.points_required} onChange={(e) => setCurrentLevel({...currentLevel, points_required: e.target.value})} /></div>
            )}
            <div><Label htmlFor="levelRewards">Descripción Recompensas</Label><Textarea id="levelRewards" value={currentLevel.rewards_desc} onChange={(e) => setCurrentLevel({...currentLevel, rewards_desc: e.target.value})} /></div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={handleSaveLevel} disabled={isLoading}>{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Guardar Nivel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </motion.div>
  );
};

export default LoyaltyPrograms;