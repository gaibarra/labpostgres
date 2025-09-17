import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ThumbsUp, MessageSquare, Share2, Eye } from 'lucide-react';
import { format } from 'date-fns';

const DetailsModal = ({ isOpen, onOpenChange, selectedPost }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-theme-midnight dark:text-theme-powder text-xl">Detalles de Publicación: {selectedPost?.platform}</DialogTitle>
          <DialogDescription>Información y métricas (simuladas) de la publicación.</DialogDescription>
        </DialogHeader>
        {selectedPost && (
          <ScrollArea className="max-h-[60vh] pr-3">
            <div className="space-y-3 py-2">
              <p><strong>Plataforma:</strong> {selectedPost.platform}</p>
              <p><strong>Fecha/Hora Publicación:</strong> {selectedPost.publish_date_time ? format(new Date(selectedPost.publish_date_time), 'dd/MM/yyyy HH:mm') : 'N/A'}</p>
              <p><strong>Estado:</strong> {selectedPost.status}</p>
              <p><strong>Tipo Contenido:</strong> {selectedPost.content_type}</p>
              {selectedPost.media_url && <p><strong>URL Medio:</strong> <a href={selectedPost.media_url} target="_blank" rel="noopener noreferrer" className="text-theme-celestial hover:underline">{selectedPost.media_url}</a></p>}
              <p><strong>Contenido:</strong></p>
              <p className="text-sm bg-slate-100 dark:bg-theme-davy-dark/30 p-2 rounded whitespace-pre-wrap">{selectedPost.content}</p>
              <p><strong>Hashtags:</strong> {selectedPost.hashtags || 'Ninguno'}</p>
              <p><strong>Notas:</strong> {selectedPost.notes || 'Ninguna'}</p>
              <Card className="mt-4 bg-slate-50 dark:bg-theme-davy-dark/30">
                <CardHeader><CardTitle className="text-md">Métricas de Engagement (Simuladas)</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-2 text-sm">
                  <p className="flex items-center"><ThumbsUp className="h-4 w-4 mr-1 text-blue-500"/> Likes: {selectedPost.engagement.likes.toLocaleString()}</p>
                  <p className="flex items-center"><MessageSquare className="h-4 w-4 mr-1 text-green-500"/> Comentarios: {selectedPost.engagement.comments.toLocaleString()}</p>
                  <p className="flex items-center"><Share2 className="h-4 w-4 mr-1 text-purple-500"/> Compartidos: {selectedPost.engagement.shares.toLocaleString()}</p>
                  <p className="flex items-center"><Eye className="h-4 w-4 mr-1 text-gray-500"/> Vistas: {selectedPost.engagement.views.toLocaleString()}</p>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        )}
        <DialogFooter className="pt-4">
          <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DetailsModal;