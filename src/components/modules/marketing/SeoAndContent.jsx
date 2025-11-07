import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from 'framer-motion';
import { SearchCheck, PlusCircle, Edit3, Globe, Type, TrendingUp, BarChartHorizontalBig, Activity, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { logAuditEvent } from '@/lib/auditUtils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DatePicker } from '@/components/ui/datepicker'; 
import { format, parseISO } from 'date-fns';
import { apiClient } from '@/lib/apiClient';
import { useSettings } from '@/contexts/SettingsContext';
// import { useAuth } from '@/contexts/AuthContext';

const initialKeywordForm = { id: null, keyword: '', target_url: '', volume: '', difficulty: '', position: '', notes: '' };
const initialContentForm = { id: null, title: '', author: '', publish_date: null, content: '', status: 'Borrador', category: '', tags: '' };
const contentStatuses = ['Borrador', 'Revisión', 'Programado', 'Publicado', 'Archivado'];
const contentCategories = ['Salud General', 'Avances Médicos', 'Consejos Bienestar', 'Noticias Laboratorio', 'Guías Pacientes'];

const SeoAndContent = () => {
  const { toast } = useToast();
  // const { user } = useAuth();
  const { settings } = useSettings();
  const [activeTab, setActiveTab] = useState('keywords');
  
  const [keywords, setKeywords] = useState([]);
  const [webContent, setWebContent] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const [isKeywordFormOpen, setIsKeywordFormOpen] = useState(false);
  const [currentKeyword, setCurrentKeyword] = useState(initialKeywordForm);
  const [keywordFormMode, setKeywordFormMode] = useState('new');

  const [isContentFormOpen, setIsContentFormOpen] = useState(false);
  const [currentContentItem, setCurrentContentItem] = useState(initialContentForm);
  const [contentFormMode, setContentFormMode] = useState('new');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [pageAnalysisUrl, setPageAnalysisUrl] = useState('');
  const [pageAnalysisResult, setPageAnalysisResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [keywordsRes, contentRes] = await Promise.all([
        apiClient.get('/marketing/seo/keywords'),
        apiClient.get('/marketing/seo/content')
      ]);

      setKeywords(Array.isArray(keywordsRes) ? keywordsRes : []);
      setWebContent((Array.isArray(contentRes) ? contentRes : []).map(c => ({
        ...c,
        publish_date: c.publish_date ? parseISO(c.publish_date) : null
      })));
    } catch (error) {
      toast({ title: 'Error', description: `No se pudieron cargar los datos de SEO: ${error.message || error}`, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSaveKeyword = async () => {
    if (!currentKeyword.keyword || !currentKeyword.target_url) {
      toast({ title: "Error", description: "Palabra clave y URL objetivo son obligatorias.", variant: "destructive" });
      return;
    }
    
    setIsLoading(true);
    const payload = { ...currentKeyword };
    delete payload.id; // id lo maneja el server
    try {
      let saved;
      if (keywordFormMode === 'new') {
        saved = await apiClient.post('/marketing/seo/keywords', payload);
        await logAuditEvent('Marketing:SEOKeywordAgregada', { keywordId: saved.id, keyword: saved.keyword });
        toast({ title: 'Palabra Clave Agregada' });
      } else {
        saved = await apiClient.put(`/marketing/seo/keywords/${currentKeyword.id}`, payload);
        await logAuditEvent('Marketing:SEOKeywordActualizada', { keywordId: saved.id, keyword: saved.keyword });
        toast({ title: 'Palabra Clave Actualizada' });
      }
      loadData();
      setIsKeywordFormOpen(false);
      setCurrentKeyword(initialKeywordForm);
    } catch (error) {
      toast({ title: 'Error al guardar keyword', description: error.message || String(error), variant: 'destructive' });
    } finally { setIsLoading(false); }
  };

  const handleSaveContent = async () => {
    if (!currentContentItem.title || !currentContentItem.content) {
      toast({ title: "Error", description: "Título y contenido son obligatorios.", variant: "destructive" });
      return;
    }
    
    setIsLoading(true);
    const payload = {
      ...currentContentItem,
      publish_date: currentContentItem.publish_date ? format(currentContentItem.publish_date, 'yyyy-MM-dd') : null
    };
    delete payload.id;

    try {
      let saved;
      if (contentFormMode === 'new') {
        saved = await apiClient.post('/marketing/seo/content', payload);
        await logAuditEvent('Marketing:ContenidoWebCreado', { contentId: saved.id, title: saved.title });
        toast({ title: 'Contenido Web Creado' });
      } else {
        saved = await apiClient.put(`/marketing/seo/content/${currentContentItem.id}`, payload);
        await logAuditEvent('Marketing:ContenidoWebActualizado', { contentId: saved.id, title: saved.title });
        toast({ title: 'Contenido Web Actualizado' });
      }
      loadData();
      setIsContentFormOpen(false);
      setCurrentContentItem(initialContentForm);
    } catch (error) {
      toast({ title: 'Error al guardar contenido', description: error.message || String(error), variant: 'destructive' });
    } finally { setIsLoading(false); }
  };
  
  const openKeywordForm = (mode = 'new', keyword = null) => {
    setKeywordFormMode(mode);
    setCurrentKeyword(mode === 'edit' && keyword ? keyword : initialKeywordForm);
    setIsKeywordFormOpen(true);
  };

  const openContentForm = (mode = 'new', contentItem = null) => {
    setContentFormMode(mode);
    setCurrentContentItem(mode === 'edit' && contentItem ? { ...contentItem, publish_date: contentItem.publish_date ? (typeof contentItem.publish_date === 'string' ? parseISO(contentItem.publish_date) : contentItem.publish_date) : null } : initialContentForm);
    setIsContentFormOpen(true);
  };

  const handleAnalyzePage = () => {
    if (!pageAnalysisUrl || !pageAnalysisUrl.startsWith('http')) {
      toast({ title: "Error", description: "Por favor, ingresa una URL válida (ej: https://ejemplo.com).", variant: "destructive" });
      return;
    }
    setIsAnalyzing(true);
    setPageAnalysisResult(null);
    logAuditEvent('Marketing:AnalisisPaginaIniciado', { url: pageAnalysisUrl });
    setTimeout(() => {
      setPageAnalysisResult({
        url: pageAnalysisUrl,
        seoScore: Math.floor(Math.random() * 40) + 60, 
        readabilityScore: Math.floor(Math.random() * 30) + 70,
        performanceScore: Math.floor(Math.random() * 50) + 50,
        keywordsFound: Math.floor(Math.random() * 10) + 5,
        wordCount: Math.floor(Math.random() * 1000) + 300,
        mobileFriendly: Math.random() > 0.2,
        hasSitemap: Math.random() > 0.3,
        hasRobotsTxt: Math.random() > 0.1,
        recommendations: [
          "Optimizar imágenes para reducir tiempo de carga.",
          "Mejorar la densidad de la palabra clave principal.",
          "Añadir enlaces internos a contenido relevante.",
          "Considerar añadir un video explicativo.",
          "Revisar meta descripción para mayor CTR."
        ].sort(() => 0.5 - Math.random()).slice(0,3) 
      });
      setIsAnalyzing(false);
      toast({ title: "Análisis Completado", description: `Análisis simulado para ${pageAnalysisUrl} finalizado.` });
    }, 2500);
  };

  const filteredKeywords = keywords.filter(k => k.keyword.toLowerCase().includes(searchTerm.toLowerCase()) || k.target_url.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredWebContent = webContent.filter(c => c.title.toLowerCase().includes(searchTerm.toLowerCase()) || (c.category && c.category.toLowerCase().includes(searchTerm.toLowerCase())) || (c.tags && c.tags.toLowerCase().includes(searchTerm.toLowerCase())));

  const renderContentForTab = () => {
    switch (activeTab) {
      case 'keywords':
        return (
          <>
            <div className="flex justify-between items-center mb-4">
              <Input placeholder="Buscar palabras clave..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-sm bg-white dark:bg-theme-davy-dark/50 border-theme-powder dark:border-theme-davy" />
              <Button onClick={() => openKeywordForm('new')} className="bg-gradient-to-r from-theme-celestial to-theme-midnight hover:from-theme-celestial-dark hover:to-theme-midnight-dark text-white"><PlusCircle className="mr-2 h-4 w-4" /> Añadir Keyword</Button>
            </div>
            <ScrollArea className="h-[400px] rounded-md border border-theme-powder dark:border-theme-davy">
              <Table>
                <TableHeader><TableRow><TableHead>Keyword</TableHead><TableHead>URL Objetivo</TableHead><TableHead>Vol. (Sim.)</TableHead><TableHead>Dif. (Sim.)</TableHead><TableHead>Pos. (Sim.)</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                  ) : filteredKeywords.length > 0 ? filteredKeywords.map(k => (
                    <TableRow key={k.id}>
                      <TableCell>{k.keyword}</TableCell><TableCell className="truncate max-w-xs"><a href={k.target_url} target="_blank" rel="noopener noreferrer" className="text-theme-celestial hover:underline">{k.target_url}</a></TableCell>
                      <TableCell>{k.volume || 'N/A'}</TableCell><TableCell>{k.difficulty || 'N/A'}</TableCell><TableCell>{k.position || 'N/A'}</TableCell>
                      <TableCell className="text-right"><Button variant="outline" size="icon" onClick={() => openKeywordForm('edit', k)}><Edit3 className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  )) : <TableRow><TableCell colSpan={6} className="text-center">No hay palabras clave.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </ScrollArea>
          </>
        );
      case 'pageAnalysis':
        return (
          <div className="space-y-6">
            <div className="flex items-end gap-2">
              <div className="flex-grow"><Label htmlFor="pageUrl">URL de la Página a Analizar</Label><Input id="pageUrl" value={pageAnalysisUrl} onChange={(e) => setPageAnalysisUrl(e.target.value)} placeholder="https://www.ejemplo.com/pagina-a-optimizar" className="bg-white dark:bg-theme-davy-dark/50 border-theme-powder dark:border-theme-davy"/></div>
              <Button onClick={handleAnalyzePage} disabled={isAnalyzing} className="bg-gradient-to-r from-theme-celestial to-theme-midnight hover:from-theme-celestial-dark hover:to-theme-midnight-dark text-white">
                {isAnalyzing ? <Activity className="mr-2 h-4 w-4 animate-spin" /> : <BarChartHorizontalBig className="mr-2 h-4 w-4" />} Analizar Página
              </Button>
            </div>
            {pageAnalysisResult && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 border rounded-lg bg-slate-50 dark:bg-theme-davy-dark/30 border-theme-powder dark:border-theme-davy space-y-3">
                <h3 className="text-lg font-semibold text-theme-midnight dark:text-theme-powder">Resultados del Análisis para: <span className="text-theme-celestial">{pageAnalysisResult.url}</span></h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card><CardHeader><CardTitle className="text-sm">Puntuación SEO</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{pageAnalysisResult.seoScore}/100</CardContent></Card>
                  <Card><CardHeader><CardTitle className="text-sm">Legibilidad</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{pageAnalysisResult.readabilityScore}/100</CardContent></Card>
                  <Card><CardHeader><CardTitle className="text-sm">Rendimiento</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{pageAnalysisResult.performanceScore}/100</CardContent></Card>
                </div>
                <p><strong>Palabras Clave Encontradas (Simulado):</strong> {pageAnalysisResult.keywordsFound}</p>
                <p><strong>Conteo de Palabras (Simulado):</strong> {pageAnalysisResult.wordCount}</p>
                <p><strong>Adaptado a Móviles:</strong> {pageAnalysisResult.mobileFriendly ? <CheckCircle className="inline h-5 w-5 text-green-500"/> : <AlertCircle className="inline h-5 w-5 text-red-500"/>}</p>
                <p><strong>Sitemap Detectado:</strong> {pageAnalysisResult.hasSitemap ? <CheckCircle className="inline h-5 w-5 text-green-500"/> : <AlertCircle className="inline h-5 w-5 text-red-500"/>}</p>
                <p><strong>Robots.txt Detectado:</strong> {pageAnalysisResult.hasRobotsTxt ? <CheckCircle className="inline h-5 w-5 text-green-500"/> : <AlertCircle className="inline h-5 w-5 text-red-500"/>}</p>
                <h4 className="font-semibold">Recomendaciones (Simuladas):</h4>
                <ul className="list-disc list-inside text-sm">{pageAnalysisResult.recommendations.map((rec, i) => <li key={i}>{rec}</li>)}</ul>
              </motion.div>
            )}
          </div>
        );
      case 'contentManager':
        return (
          <>
            <div className="flex justify-between items-center mb-4">
              <Input placeholder="Buscar artículos..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-sm bg-white dark:bg-theme-davy-dark/50 border-theme-powder dark:border-theme-davy" />
              <Button onClick={() => openContentForm('new')} className="bg-gradient-to-r from-theme-celestial to-theme-midnight hover:from-theme-celestial-dark hover:to-theme-midnight-dark text-white"><PlusCircle className="mr-2 h-4 w-4" /> Nuevo Artículo</Button>
            </div>
            <ScrollArea className="h-[400px] rounded-md border border-theme-powder dark:border-theme-davy">
              <Table>
                <TableHeader><TableRow><TableHead>Título</TableHead><TableHead>Autor</TableHead><TableHead>Fecha Pub.</TableHead><TableHead>Categoría</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                  ) : filteredWebContent.length > 0 ? filteredWebContent.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.title}</TableCell><TableCell>{c.author}</TableCell>
                      <TableCell>{c.publish_date ? format(c.publish_date, 'dd/MM/yy') : 'N/A'}</TableCell>
                      <TableCell>{c.category}</TableCell>
                      <TableCell><span className={`px-2 py-1 text-xs font-semibold rounded-full ${ c.status === 'Publicado' ? 'bg-green-100 text-green-700' : c.status === 'Borrador' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'}`}>{c.status}</span></TableCell>
                      <TableCell className="text-right"><Button variant="outline" size="icon" onClick={() => openContentForm('edit', c)}><Edit3 className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  )) : <TableRow><TableCell colSpan={6} className="text-center">No hay contenido web.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </ScrollArea>
          </>
        );
      default: return null;
    }
  };

  const labWebsite = settings?.labInfo?.website?.trim();
  const hasWebsite = !!(labWebsite && labWebsite.length > 5);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="space-y-6">
      <Card className="shadow-xl glass-card overflow-hidden">
        <CardHeader className="bg-gradient-to-br from-theme-celestial/20 via-theme-powder/20 to-theme-periwinkle/20 dark:from-theme-celestial/30 dark:via-theme-powder/30 dark:to-theme-periwinkle/30 p-6">
          <div className="flex items-center">
            <SearchCheck className="h-10 w-10 mr-4 text-theme-celestial dark:text-theme-celestial-light" />
            <div>
              <CardTitle className="text-3xl font-bold text-theme-midnight dark:text-theme-powder">SEO y Contenido Web</CardTitle>
              <CardDescription className="text-theme-davy dark:text-theme-powder/80">Optimiza tu presencia online y gestiona tu contenido.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {!hasWebsite && (
            <div className="mb-6 border border-amber-400 dark:border-amber-500 rounded-md p-4 bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200">
              <h3 className="font-semibold text-amber-700 dark:text-amber-300 mb-1">¿Aún no cuentas con Página Web?</h3>
              <p className="text-sm mb-2">
                Para aprovechar al máximo esta sección (análisis SEO, planeación de contenidos y optimización), necesitas un sitio web activo del laboratorio. 
                Podemos ayudarte a crear uno profesional y listo para posicionamiento.
              </p>
              <p className="text-sm mb-2">
                Contacta al creador de esta plataforma:
              </p>
              <ul className="text-sm list-disc list-inside mb-3 space-y-1">
                <li><strong>C.P. Gonzalo Arturo Ibarra Mendoza</strong></li>
                <li>Email: <a className="underline" href="mailto:proyectoG40@gmail.com">proyectoG40@gmail.com</a></li>
                <li>Tel / WhatsApp: <a className="underline" href="tel:+526535388499">+52 653 538 8499</a></li>
              </ul>
              <p className="text-xs opacity-80 mb-3">Una vez que tengas el sitio, agrega la URL en Administración &gt; Información del Laboratorio para habilitar análisis contextual.</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => toast({ title: 'Agregar URL', description: 'Ve a Administración > Información del Laboratorio y llena el campo Sitio Web.' })}>Agregar URL ahora</Button>
                <Button size="sm" onClick={() => window.open('mailto:proyectoG40@gmail.com?subject=Solicitud%20Sitio%20Web%20Laboratorio', '_blank')} className="bg-gradient-to-r from-theme-celestial to-theme-midnight text-white">Solicitar Sitio Web</Button>
              </div>
            </div>
          )}
          <Tabs value={activeTab} onValueChange={(newTab) => { setActiveTab(newTab); setSearchTerm(''); setPageAnalysisResult(null); }} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="keywords" className="flex items-center gap-2"><TrendingUp className="h-4 w-4"/>Palabras Clave</TabsTrigger>
              <TabsTrigger value="pageAnalysis" className="flex items-center gap-2"><Globe className="h-4 w-4"/>Análisis de Páginas</TabsTrigger>
              <TabsTrigger value="contentManager" className="flex items-center gap-2"><Type className="h-4 w-4"/>Gestor de Contenido</TabsTrigger>
            </TabsList>
            <TabsContent value="keywords">{renderContentForTab()}</TabsContent>
            <TabsContent value="pageAnalysis">{renderContentForTab()}</TabsContent>
            <TabsContent value="contentManager">{renderContentForTab()}</TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={isKeywordFormOpen} onOpenChange={(isOpen) => { setIsKeywordFormOpen(isOpen); if (!isOpen) setCurrentKeyword(initialKeywordForm); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{keywordFormMode === 'new' ? 'Añadir Palabra Clave' : 'Editar Palabra Clave'}</DialogTitle>
            <DialogDescription className="sr-only">
              Formulario para {keywordFormMode === 'new' ? 'añadir una nueva' : 'editar una'} palabra clave incluyendo URL objetivo, métricas simuladas y notas.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div><Label htmlFor="kwKeyword">Palabra Clave</Label><Input id="kwKeyword" value={currentKeyword.keyword} onChange={(e) => setCurrentKeyword({...currentKeyword, keyword: e.target.value})} /></div>
            <div><Label htmlFor="kwTargetUrl">URL Objetivo</Label><Input id="kwTargetUrl" value={currentKeyword.target_url} onChange={(e) => setCurrentKeyword({...currentKeyword, target_url: e.target.value})} placeholder="https://ejemplo.com/servicio"/></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><Label htmlFor="kwVolume">Volumen (Sim.)</Label><Input id="kwVolume" value={currentKeyword.volume} onChange={(e) => setCurrentKeyword({...currentKeyword, volume: e.target.value})} placeholder="Ej: 1500"/></div>
              <div><Label htmlFor="kwDifficulty">Dificultad (Sim.)</Label><Input id="kwDifficulty" value={currentKeyword.difficulty} onChange={(e) => setCurrentKeyword({...currentKeyword, difficulty: e.target.value})} placeholder="Ej: 65"/></div>
              <div><Label htmlFor="kwPosition">Posición (Sim.)</Label><Input id="kwPosition" value={currentKeyword.position} onChange={(e) => setCurrentKeyword({...currentKeyword, position: e.target.value})} placeholder="Ej: 3"/></div>
            </div>
            <div><Label htmlFor="kwNotes">Notas</Label><Textarea id="kwNotes" value={currentKeyword.notes} onChange={(e) => setCurrentKeyword({...currentKeyword, notes: e.target.value})} placeholder="Notas adicionales sobre esta keyword..."/></div>
          </div>
          <DialogFooter><DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose><Button onClick={handleSaveKeyword} disabled={isLoading}>{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Guardar Keyword</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isContentFormOpen} onOpenChange={(isOpen) => { setIsContentFormOpen(isOpen); if (!isOpen) setCurrentContentItem(initialContentForm); }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{contentFormMode === 'new' ? 'Nuevo Artículo/Contenido' : 'Editar Artículo/Contenido'}</DialogTitle>
            <DialogDescription className="sr-only">
              Formulario para {contentFormMode === 'new' ? 'crear un nuevo' : 'editar el'} artículo o contenido web incluyendo título, autor, fecha, categoría, etiquetas, cuerpo y estado.
            </DialogDescription>
          </DialogHeader>
           <ScrollArea className="max-h-[calc(90vh-200px)] pr-5">
            <div className="grid gap-4 py-4">
              <div><Label htmlFor="contentTitle">Título</Label><Input id="contentTitle" value={currentContentItem.title} onChange={(e) => setCurrentContentItem({...currentContentItem, title: e.target.value})} /></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label htmlFor="contentAuthor">Autor</Label><Input id="contentAuthor" value={currentContentItem.author} onChange={(e) => setCurrentContentItem({...currentContentItem, author: e.target.value})} /></div>
                <div><Label htmlFor="contentPublishDate">Fecha Publicación</Label><DatePicker date={currentContentItem.publish_date} setDate={(date) => setCurrentContentItem({...currentContentItem, publish_date: date})} buttonClassName="w-full"/></div>
              </div>
              <div>
                <Label htmlFor="contentCategory">Categoría</Label>
                <SearchableSelect
                  value={currentContentItem.category}
                  onValueChange={(val) => setCurrentContentItem({...currentContentItem, category: val})}
                  options={contentCategories.map(cat => ({ value: cat, label: cat }))}
                  placeholder="Seleccionar categoría..."
                  searchPlaceholder="Buscar categoría..."
                  emptyText="Sin categorías"
                />
              </div>
              <div><Label htmlFor="contentTags">Etiquetas (separadas por coma)</Label><Input id="contentTags" value={currentContentItem.tags} onChange={(e) => setCurrentContentItem({...currentContentItem, tags: e.target.value})} placeholder="salud, bienestar, análisis"/></div>
              <div><Label htmlFor="contentBody">Contenido</Label><Textarea id="contentBody" value={currentContentItem.content} onChange={(e) => setCurrentContentItem({...currentContentItem, content: e.target.value})} rows={12} placeholder="Escribe aquí el contenido del artículo..."/></div>
              <div>
                <Label htmlFor="contentStatus">Estado</Label>
                <SearchableSelect
                  value={currentContentItem.status}
                  onValueChange={(val) => setCurrentContentItem({...currentContentItem, status: val})}
                  options={contentStatuses.map(s => ({ value: s, label: s }))}
                  placeholder="Seleccionar estado"
                  searchPlaceholder="Buscar estado..."
                  emptyText="Sin estados"
                />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter><DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose><Button onClick={handleSaveContent} disabled={isLoading}>{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Guardar Contenido</Button></DialogFooter>
        </DialogContent>
      </Dialog>

    </motion.div>
  );
};

export default SeoAndContent;