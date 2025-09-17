import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from '@/components/ui/scroll-area';
import { DatePicker } from '@/components/ui/datepicker';
import { Loader2 } from 'lucide-react';

const PostFormDialog = ({
  isOpen,
  onOpenChange,
  formMode,
  currentPost,
  handleInputChange,
  handleDateChange,
  publishTime,
  setPublishTime,
  handleSavePost,
  isLoading,
  socialPlatforms,
  postStatuses,
  contentTypes,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
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
                <Select value={currentPost.platform} onValueChange={(value) => handleInputChange('platform', value)}>
                  <SelectTrigger id="postPlatform"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {socialPlatforms.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="postStatus">Estado</Label>
                <Select value={currentPost.status} onValueChange={(value) => handleInputChange('status', value)}>
                  <SelectTrigger id="postStatus"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {postStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
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
                <Select value={currentPost.content_type} onValueChange={(value) => handleInputChange('content_type', value)}>
                  <SelectTrigger id="contentType"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {contentTypes.map(ct => <SelectItem key={ct} value={ct}>{ct}</SelectItem>)}
                  </SelectContent>
                </Select>
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
  );
};

export default PostFormDialog;