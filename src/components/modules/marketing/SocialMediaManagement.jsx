import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
// removed legacy Select usage in this component
import SearchableSelect from '@/components/ui/SearchableSelect';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { motion } from 'framer-motion';
import { Users as SocialIcon, PlusCircle, Edit3, Search, Eye, Archive, Image as ImageIcon, Video, Link as LinkIcon, MessageSquare, ThumbsUp, Share2, Loader2 } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { logAuditEvent } from '@/lib/auditUtils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DatePicker } from '@/components/ui/datepicker'; 
import { format, parseISO, setHours, setMinutes, setSeconds } from 'date-fns';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';

const initialPostForm = {
  id: null,
  platform: 'Facebook',
  publish_date_time: null,
  content: '',
  content_type: 'Texto',
  media_url: '',
  hashtags: '',
  status: 'Borrador',
  notes: '',
  engagement: {
    likes: 0,
    comments: 0,
    shares: 0,
    views: 0,
  }
};

const socialPlatforms = ['Facebook', 'Instagram', 'LinkedIn', 'X (Twitter)', 'TikTok', 'YouTube', 'Pinterest', 'Otra'];
const contentTypes = ['Texto', 'Imagen', 'Video', 'Enlace', 'Historia'];
const postStatuses = ['Borrador', 'Programada', 'Publicada', 'Archivada', 'Error al publicar'];

const SocialMediaManagement = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentPost, setCurrentPost] = useState(initialPostForm);
  const [formMode, setFormMode] = useState('new'); 
  const [searchTerm, setSearchTerm] = useState('');
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedPostDetails, setSelectedPostDetails] = useState(null);
  const [publishTime, setPublishTime] = useState('10:00');

  const loadPosts = useCallback(async () => {
    // REPLACED Supabase with REST apiClient
    setIsLoading(true);
    try {
      const data = await apiClient.get('/marketing/social-posts');
      setPosts(data.map(p => ({
        ...p,
        publish_date_time: p.publish_date_time ? parseISO(p.publish_date_time) : null,
        engagement: p.engagement || { likes:0, comments:0, shares:0, views:0 }
      })));
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudieron cargar las publicaciones.', variant: 'destructive' });
      console.error(error);
    } finally { setIsLoading(false); }
  }, [toast]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const handleSavePost = async () => {
    if (!currentPost.platform || !currentPost.publish_date_time || !currentPost.content) {
      toast({ title: "Error", description: "Plataforma, fecha/hora de publicación y contenido son obligatorios.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    const [hours, minutes] = publishTime.split(':').map(Number);
    const finalPublishDateTime = setSeconds(setMinutes(setHours(currentPost.publish_date_time, hours), minutes), 0);

    const postData = {
      platform: currentPost.platform,
      publish_date_time: finalPublishDateTime.toISOString(),
      content: currentPost.content,
      content_type: currentPost.content_type,
      media_url: currentPost.media_url,
      hashtags: currentPost.hashtags,
      status: currentPost.status,
      notes: currentPost.notes,
      engagement: currentPost.engagement,
      user_id: user.id,
    };

    try {
      if (formMode === 'new') {
        const data = await apiClient.post('/marketing/social-posts', postData);
        await logAuditEvent('Marketing:PublicacionRedSocialCreada', { postId: data.id, platform: data.platform });
        toast({ title: 'Publicación Creada', description: `La publicación para "${data.platform}" ha sido creada.` });
      } else {
        const data = await apiClient.put(`/marketing/social-posts/${currentPost.id}`, postData);
        await logAuditEvent('Marketing:PublicacionRedSocialActualizada', { postId: data.id, platform: data.platform });
        toast({ title: 'Publicación Actualizada', description: `La publicación para "${data.platform}" ha sido actualizada.` });
      }
      setIsFormOpen(false);
      setCurrentPost(initialPostForm);
      setPublishTime('10:00');
      loadPosts();
    } catch (error) {
      toast({ title: 'Error al guardar', description: error.message, variant: 'destructive' });
      console.error(error);
    } finally { setIsLoading(false); }
  };

  const handleInputChange = (field, value) => {
    setCurrentPost(prev => ({ ...prev, [field]: value }));
  };
  
  const handleDateChange = (date) => {
    setCurrentPost(prev => ({ ...prev, publish_date_time: date }));
  };

  const openForm = (mode = 'new', post = null) => {
    setFormMode(mode);
    if (mode === 'edit' && post) {
      const postDate = post.publish_date_time ? (typeof post.publish_date_time === 'string' ? parseISO(post.publish_date_time) : post.publish_date_time) : null;
      setCurrentPost({ 
        ...initialPostForm, 
        ...post,
        publish_date_time: postDate,
      });
      if (postDate) {
        setPublishTime(format(postDate, 'HH:mm'));
      } else {
        setPublishTime('10:00');
      }
    } else {
      setCurrentPost(initialPostForm);
      setPublishTime('10:00');
    }
    setIsFormOpen(true);
  };

  const handleViewDetails = (post) => {
    setSelectedPostDetails(post);
    setIsDetailsModalOpen(true);
  };

  const handleArchivePost = async (postId) => {
    const postToArchive = posts.find(p => p.id === postId);
    if (!postToArchive) return;

    setIsLoading(true);
    try {
      const data = await apiClient.post(`/marketing/social-posts/${postId}/archive`);
      await logAuditEvent('Marketing:PublicacionRedSocialArchivada', { postId: data.id, platform: data.platform });
      toast({ title: 'Publicación Archivada', description: `La publicación para "${data.platform}" ha sido archivada.` });
      loadPosts();
    } catch (error) {
      toast({ title: 'Error al archivar', description: error.message, variant: 'destructive' });
      console.error(error);
    } finally { setIsLoading(false); }
  };
  
  const filteredPosts = posts.filter(post =>
    post.platform?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    post.content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    post.status?.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => (b.publish_date_time && a.publish_date_time) ? b.publish_date_time.getTime() - a.publish_date_time.getTime() : 0);


  const getContentTypeIcon = (type) => {
    switch(type) {
      case 'Imagen': return <ImageIcon className="h-4 w-4 text-theme-celestial" />;
      case 'Video': return <Video className="h-4 w-4 text-red-500" />;
      case 'Enlace': return <LinkIcon className="h-4 w-4 text-green-500" />;
      default: return <MessageSquare className="h-4 w-4 text-theme-davy" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <Card className="shadow-xl glass-card overflow-hidden">
        <CardHeader className="bg-gradient-to-br from-theme-celestial/20 via-theme-powder/20 to-theme-periwinkle/20 dark:from-theme-celestial/30 dark:via-theme-powder/30 dark:to-theme-periwinkle/30 p-6">
          <div className="flex items-center">
            <SocialIcon className="h-10 w-10 mr-4 text-theme-celestial dark:text-theme-celestial-light" />
            <div>
              <CardTitle className="text-3xl font-bold text-theme-midnight dark:text-theme-powder">
                Gestión de Redes Sociales
              </CardTitle>
              <CardDescription className="text-theme-davy dark:text-theme-powder/80">
                Planifica, programa y analiza tus publicaciones en redes sociales.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
            <div className="relative w-full sm:w-1/3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-theme-davy/70" />
              <Input
                type="text"
                placeholder="Buscar publicaciones..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white dark:bg-theme-davy-dark/50 border-theme-powder dark:border-theme-davy"
              />
            </div>
            <Button onClick={() => openForm('new')} className="w-full sm:w-auto bg-gradient-to-r from-theme-celestial to-theme-midnight hover:from-theme-celestial-dark hover:to-theme-midnight-dark text-white">
              <PlusCircle className="mr-2 h-4 w-4" /> Nueva Publicación
            </Button>
          </div>

          <ScrollArea className="h-[450px] rounded-md border border-theme-powder dark:border-theme-davy">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plataforma</TableHead>
                  <TableHead>Fecha/Hora</TableHead>
                  <TableHead>Contenido (Extracto)</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                ) : filteredPosts.length > 0 ? filteredPosts.map(post => (
                  <TableRow key={post.id}>
                    <TableCell className="font-medium">{post.platform}</TableCell>
                    <TableCell>
                      {post.publish_date_time ? format(post.publish_date_time, 'dd/MM/yy HH:mm') : 'N/A'}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{post.content}</TableCell>
                    <TableCell>{getContentTypeIcon(post.content_type)}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        post.status === 'Publicada' ? 'bg-green-100 text-green-700 dark:bg-green-700/30 dark:text-green-300' :
                        post.status === 'Programada' ? 'bg-blue-100 text-blue-700 dark:bg-blue-700/30 dark:text-blue-300' :
                        post.status === 'Borrador' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-700/30 dark:text-yellow-300' :
                        post.status === 'Archivada' ? 'bg-gray-100 text-gray-700 dark:bg-gray-700/30 dark:text-gray-300' :
                        'bg-red-100 text-red-700 dark:bg-red-700/30 dark:text-red-300' 
                      }`}>
                        {post.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="outline" size="icon" onClick={() => handleViewDetails(post)} title="Ver Detalles" className="border-theme-celestial text-theme-celestial hover:bg-theme-celestial/10">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => openForm('edit', post)} title="Editar Publicación" className="border-theme-celestial text-theme-celestial hover:bg-theme-celestial/10">
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      {post.status !== 'Archivada' && (
                        <Button variant="outline" size="icon" onClick={() => handleArchivePost(post.id)} title="Archivar Publicación" className="border-theme-davy text-theme-davy hover:bg-theme-davy/10" disabled={isLoading}>
                          <Archive className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-theme-davy dark:text-theme-powder/70">No se encontraron publicaciones.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={(isOpen) => { setIsFormOpen(isOpen); if (!isOpen) { setCurrentPost(initialPostForm); setPublishTime('10:00');} }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-theme-midnight dark:text-theme-powder text-xl">
              {formMode === 'new' ? 'Nueva Publicación para Redes Sociales' : `Editar Publicación: ${currentPost.platform}`}
            </DialogTitle>
            <DialogDescription>
              {formMode === 'new' ? 'Completa los detalles de la nueva publicación.' : 'Actualiza la información de la publicación.'}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(90vh-200px)] pr-5">
            <div className="grid gap-4 py-4 ">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="postPlatform">Plataforma</Label>
                  <SearchableSelect
                    value={currentPost.platform}
                    onValueChange={(value) => handleInputChange('platform', value)}
                    options={socialPlatforms.map(p => ({ value: p, label: p }))}
                    placeholder="Seleccionar plataforma"
                    searchPlaceholder="Buscar plataforma..."
                    emptyText="Sin plataformas"
                  />
                </div>
                <div>
                  <Label htmlFor="postStatus">Estado</Label>
                  <SearchableSelect
                    value={currentPost.status}
                    onValueChange={(value) => handleInputChange('status', value)}
                    options={postStatuses.map(s => ({ value: s, label: s }))}
                    placeholder="Seleccionar estado"
                    searchPlaceholder="Buscar estado..."
                    emptyText="Sin estados"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="publishDate">Fecha de Publicación</Label>
                  <DatePicker date={currentPost.publish_date_time} setDate={handleDateChange} buttonClassName="w-full" />
                </div>
                <div>
                  <Label htmlFor="publishTime">Hora de Publicación</Label>
                  <Input id="publishTime" type="time" value={publishTime} onChange={(e) => setPublishTime(e.target.value)} />
                </div>
              </div>
              <div>
                <Label htmlFor="postContent">Contenido</Label>
                <Textarea id="postContent" value={currentPost.content} onChange={(e) => handleInputChange('content', e.target.value)} placeholder="Escribe tu publicación aquí..." rows={5}/>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="contentType">Tipo de Contenido</Label>
                  <SearchableSelect
                    value={currentPost.content_type}
                    onValueChange={(value) => handleInputChange('content_type', value)}
                    options={contentTypes.map(ct => ({ value: ct, label: ct }))}
                    placeholder="Seleccionar tipo"
                    searchPlaceholder="Buscar tipo..."
                    emptyText="Sin tipos"
                  />
                </div>
                {(currentPost.content_type === 'Imagen' || currentPost.content_type === 'Video' || currentPost.content_type === 'Enlace') && (
                  <div><Label htmlFor="mediaUrl">URL del Medio/Enlace</Label><Input id="mediaUrl" value={currentPost.media_url} onChange={(e) => handleInputChange('media_url', e.target.value)} placeholder="https://ejemplo.com/imagen.jpg"/></div>
                )}
              </div>
              <div><Label htmlFor="postHashtags">Hashtags (separados por coma)</Label><Input id="postHashtags" value={currentPost.hashtags} onChange={(e) => handleInputChange('hashtags', e.target.value)} placeholder="#salud #laboratorio #bienestar"/></div>
              <div><Label htmlFor="postNotes">Notas Adicionales</Label><Textarea id="postNotes" value={currentPost.notes} onChange={(e) => handleInputChange('notes', e.target.value)} placeholder="Ideas, audiencias, etc." rows={3}/></div>
            </div>
          </ScrollArea>
          <DialogFooter className="pt-4">
            <DialogClose asChild><Button variant="outline" disabled={isLoading}>Cancelar</Button></DialogClose>
            <Button onClick={handleSavePost} className="bg-gradient-to-r from-theme-celestial to-theme-midnight hover:from-theme-celestial-dark hover:to-theme-midnight-dark text-white" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {formMode === 'new' ? 'Crear Publicación' : 'Guardar Cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-theme-midnight dark:text-theme-powder text-xl">Detalles de Publicación: {selectedPostDetails?.platform}</DialogTitle>
            <DialogDescription>Información y métricas (simuladas) de la publicación.</DialogDescription>
          </DialogHeader>
          {selectedPostDetails && (
            <ScrollArea className="max-h-[60vh] pr-3">
              <div className="space-y-3 py-2">
                <p><strong>Plataforma:</strong> {selectedPostDetails.platform}</p>
                <p><strong>Fecha/Hora Publicación:</strong> {selectedPostDetails.publish_date_time ? format(selectedPostDetails.publish_date_time, 'dd/MM/yyyy HH:mm') : 'N/A'}</p>
                <p><strong>Estado:</strong> {selectedPostDetails.status}</p>
                <p><strong>Tipo Contenido:</strong> {selectedPostDetails.content_type}</p>
                {selectedPostDetails.media_url && <p><strong>URL Medio:</strong> <a href={selectedPostDetails.media_url} target="_blank" rel="noopener noreferrer" className="text-theme-celestial hover:underline">{selectedPostDetails.media_url}</a></p>}
                <p><strong>Contenido:</strong></p>
                <p className="text-sm bg-slate-100 dark:bg-theme-davy-dark/30 p-2 rounded whitespace-pre-wrap">{selectedPostDetails.content}</p>
                <p><strong>Hashtags:</strong> {selectedPostDetails.hashtags || 'Ninguno'}</p>
                <p><strong>Notas:</strong> {selectedPostDetails.notes || 'Ninguna'}</p>
                <Card className="mt-4 bg-slate-50 dark:bg-theme-davy-dark/30">
                  <CardHeader><CardTitle className="text-md">Métricas de Engagement (Simuladas)</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-2 gap-2 text-sm">
                    <p className="flex items-center"><ThumbsUp className="h-4 w-4 mr-1 text-blue-500"/> Likes: {selectedPostDetails.engagement.likes.toLocaleString()}</p>
                    <p className="flex items-center"><MessageSquare className="h-4 w-4 mr-1 text-green-500"/> Comentarios: {selectedPostDetails.engagement.comments.toLocaleString()}</p>
                    <p className="flex items-center"><Share2 className="h-4 w-4 mr-1 text-purple-500"/> Compartidos: {selectedPostDetails.engagement.shares.toLocaleString()}</p>
                    <p className="flex items-center"><Eye className="h-4 w-4 mr-1 text-gray-500"/> Vistas: {selectedPostDetails.engagement.views.toLocaleString()}</p>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          )}
          <DialogFooter className="pt-4">
            <Button onClick={() => setIsDetailsModalOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </motion.div>
  );
};

export default SocialMediaManagement;