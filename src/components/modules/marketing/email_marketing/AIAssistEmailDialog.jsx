import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Sparkles, Wand2, AlertTriangle } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { apiClient } from '@/lib/apiClient';
import { useSettings } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';

const AIAssistEmailDialog = ({ open, onOpenChange, onContentGenerated }) => {
  const [audience, setAudience] = useState('');
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState('informativo');
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();
  const { settings, isLoading: isLoadingSettings } = useSettings();
  const { user } = useAuth();
  
  const apiKey = settings?.integrations?.openaiApiKey;
  const labName = settings?.labInfo?.name || 'nuestro laboratorio';
  const userName = user?.profile?.first_name || 'un miembro del equipo';

  const handleGenerate = async () => {
    if (!audience || !topic) {
      toast({
        title: "Campos requeridos",
        description: "Por favor, define el público y el tema para generar el contenido.",
        variant: "destructive",
      });
      return;
    }

    if (!apiKey) {
      toast({
        title: "API Key no configurada",
        description: "La clave API de OpenAI no se ha configurado en la Administración.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const data = await apiClient.post('/marketing/email/generate-template', { audience, topic, tone, labName, userName });
      const { subject, body } = data;
      onContentGenerated({ subject, body });
      onOpenChange(false);
      toast({ title: 'Contenido generado con éxito', description: 'El asunto y el cuerpo del email han sido actualizados.', className: 'bg-green-100 dark:bg-green-800' });
    } catch (error) {
      toast({ title: 'Error al generar contenido', description: error.message || 'No se pudo contactar al asistente de IA.', variant: 'destructive' });
    } finally { setIsGenerating(false); }
  };

  const renderContent = () => {
    if (isLoadingSettings) {
      return (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
          <p className="ml-4">Cargando configuración...</p>
        </div>
      );
    }

    if (!apiKey) {
      return (
        <div className="text-center py-8 px-4 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg">
          <AlertTriangle className="mx-auto h-12 w-12 text-yellow-500" />
          <h3 className="mt-4 text-lg font-semibold text-yellow-800 dark:text-yellow-300">API Key de OpenAI no encontrada</h3>
          <p className="mt-2 text-sm text-yellow-600 dark:text-yellow-400">
            Para usar el asistente de IA, primero debes configurar tu clave API de OpenAI en la sección de integraciones.
          </p>
          <Button asChild className="mt-6">
            <Link to="/administration/general-settings" onClick={() => onOpenChange(false)}>
              Ir a Configuración
            </Link>
          </Button>
        </div>
      );
    }

    return (
      <>
        <div className="py-4 space-y-4">
          <div>
            <Label htmlFor="audience">Público Objetivo</Label>
            <Select onValueChange={setAudience} value={audience}>
              <SelectTrigger id="audience">
                <SelectValue placeholder="Selecciona un público..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pacientes">Pacientes</SelectItem>
                <SelectItem value="medicos">Médicos Referentes</SelectItem>
                <SelectItem value="instituciones">Instituciones / Empresas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="topic">Tema Principal</Label>
            <Input 
              id="topic" 
              value={topic} 
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Ej: Dieta para pacientes con diabetes, nuevos estudios de cardiología..." 
            />
          </div>
          <div>
            <Label htmlFor="tone">Tono del Mensaje</Label>
            <Select onValueChange={setTone} value={tone}>
              <SelectTrigger id="tone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="informativo">Informativo y Profesional</SelectItem>
                <SelectItem value="amigable">Amigable y Cercano</SelectItem>
                <SelectItem value="urgente">Urgente / Promocional</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isGenerating}>Cancelar</Button>
          <Button onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Generar Contenido
          </Button>
        </DialogFooter>
      </>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Wand2 className="h-6 w-6 text-purple-500" />
            <DialogTitle className="text-2xl">Asistente de IA para Email</DialogTitle>
          </div>
          <DialogDescription>
            Describe el contenido que necesitas y la IA creará un borrador para ti.
          </DialogDescription>
        </DialogHeader>
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
};

export default AIAssistEmailDialog;