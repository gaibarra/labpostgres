import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BrainCircuit, Mail, MessageSquare, Send } from 'lucide-react';

const IntegrationsSettingsTab = ({ settings, handleInputChange }) => {
  const integrations = settings?.integrations || {};
  const hasOpenAi = !!(integrations.openaiApiKey || integrations.openaiApiKeyPreview);
  const openAiPreview = integrations.openaiApiKeyPreview || (hasOpenAi && integrations.openaiApiKey ? `${integrations.openaiApiKey.slice(0,4)}***${integrations.openaiApiKey.slice(-4)}` : '');
  const meta = integrations._meta || {};
  const openAiMeta = meta.openaiApiKey || meta.openAIKey || null;

  // Estado local para impedir envío si usuario no editó
  const [openAiLocal, setOpenAiLocal] = useState('');
  const [openAiDirty, setOpenAiDirty] = useState(false);
  useEffect(()=>{
    // Cuando cambie settings externos, si no está dirty, sincronizar placeholder
    if (!openAiDirty) {
      if (integrations.openaiApiKey && integrations.openaiApiKey.startsWith('sk-')) {
        setOpenAiLocal(''); // mantenemos vacío para no re-exponer
      } else {
        setOpenAiLocal('');
      }
    }
  }, [integrations.openaiApiKey, integrations.openaiApiKeyPreview, openAiDirty]);

  // Interceptar handleInputChange para omitir envío si no cambió valor real.
  const handleOpenAiChange = (val) => {
    setOpenAiLocal(val);
    setOpenAiDirty(true);
    // Pasamos el valor al settings sólo si no es cadena vacía (usuario quiere rotar) o null (borrar)
    if (val === null) {
      handleInputChange('integrations', 'openaiApiKey', null);
      setOpenAiDirty(false);
      setOpenAiLocal('');
    } else if (val === '') {
      // No enviar todavía; limpiar del objeto integrations si existía un staging previo
      handleInputChange('integrations', 'openaiApiKey', undefined);
    } else {
      handleInputChange('integrations', 'openaiApiKey', val);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Integraciones y API Keys</CardTitle>
        <CardDescription>Conecta servicios externos para potenciar la funcionalidad de la aplicación.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <section>
          <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-3 flex items-center">
            <BrainCircuit className="mr-2 h-5 w-5 text-purple-600 dark:text-purple-400" /> API Keys de Inteligencia Artificial
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Introduce tus claves API para habilitar funciones de asistencia por IA.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="openaiApiKey">OpenAI API Key</Label>
              <Input
                id="openaiApiKey"
                type="password"
                value={openAiLocal}
                onChange={(e) => handleOpenAiChange(e.target.value)}
                placeholder={hasOpenAi ? '•••••• (clave guardada - ingresa para reemplazar)' : 'sk-...'}
              />
              {hasOpenAi && (
                <div className="mt-1 text-xs text-muted-foreground flex items-center gap-2">
                  <span>Clave guardada: <span className="font-mono">{openAiPreview}</span></span>
                  {openAiMeta && openAiMeta.updatedAt && (
                    <span className="ml-2">Actualizada: {new Date(openAiMeta.updatedAt).toLocaleString()}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleOpenAiChange(null)}
                    className="text-red-600 hover:underline"
                    title="Borrar clave (deberás guardar para aplicar)"
                  >
                    Borrar
                  </button>
                  {openAiDirty && openAiLocal && (
                    <span className="text-amber-600 dark:text-amber-400">(Pendiente de guardar)</span>
                  )}
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="deepseekKey">Deepseek API Key</Label>
              <Input id="deepseekKey" type="password" value={integrations.deepseekKey || ''} onChange={(e) => { console.log('[IntegrationsSettingsTab] onChange deepseekKey'); handleInputChange('integrations', 'deepseekKey', e.target.value); }} placeholder="dk-..." />
            </div>
            <div>
              <Label htmlFor="perplexityKey">Perplexity API Key</Label>
              <Input id="perplexityKey" type="password" value={integrations.perplexityKey || ''} onChange={(e) => { console.log('[IntegrationsSettingsTab] onChange perplexityKey'); handleInputChange('integrations', 'perplexityKey', e.target.value); }} placeholder="pplx-..." />
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-3 flex items-center">
            <Mail className="mr-2 h-5 w-5 text-blue-600 dark:text-blue-400" /> Configuración de Envío de Email
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Configura tu proveedor de servicios de email para notificaciones automáticas.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="emailServiceProvider">Proveedor de Email (Ej: SendGrid)</Label>
              <Input id="emailServiceProvider" value={integrations.emailServiceProvider || ''} onChange={(e) => { console.log('[IntegrationsSettingsTab] onChange emailServiceProvider'); handleInputChange('integrations', 'emailServiceProvider', e.target.value); }} placeholder="SendGrid" />
            </div>
            <div>
              <Label htmlFor="emailApiUser">Usuario/ID de API Email</Label>
              <Input id="emailApiUser" value={integrations.emailApiUser || ''} onChange={(e) => { console.log('[IntegrationsSettingsTab] onChange emailApiUser'); handleInputChange('integrations', 'emailApiUser', e.target.value); }} placeholder="usuario_api" />
            </div>
            <div>
              <Label htmlFor="emailApiKey">Clave API Email</Label>
              <Input id="emailApiKey" type="password" value={integrations.emailApiKey || ''} onChange={(e) => { console.log('[IntegrationsSettingsTab] onChange emailApiKey'); handleInputChange('integrations', 'emailApiKey', e.target.value); }} placeholder="SG.xxxxxxxx" />
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-3 flex items-center">
            <MessageSquare className="mr-2 h-5 w-5 text-green-600 dark:text-green-400" /> Configuración de WhatsApp (API)
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Para enviar mensajes por WhatsApp, necesitarás una API (Ej: Twilio, Meta Cloud API).
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="whatsappApiUrl">URL de la API de WhatsApp</Label>
              <Input id="whatsappApiUrl" value={integrations.whatsappApiUrl || ''} onChange={(e) => { console.log('[IntegrationsSettingsTab] onChange whatsappApiUrl'); handleInputChange('integrations', 'whatsappApiUrl', e.target.value); }} placeholder="https://api.provider.com/whatsapp/..." />
            </div>
            <div>
              <Label htmlFor="whatsappApiKey">Token/Clave API de WhatsApp</Label>
              <Input id="whatsappApiKey" type="password" value={integrations.whatsappApiKey || ''} onChange={(e) => { console.log('[IntegrationsSettingsTab] onChange whatsappApiKey'); handleInputChange('integrations', 'whatsappApiKey', e.target.value); }} placeholder="Tu clave API" />
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-3 flex items-center">
            <Send className="mr-2 h-5 w-5 text-sky-600 dark:text-sky-400" /> Configuración de Telegram (Bot)
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Configura tu bot de Telegram para enviar notificaciones.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="telegramBotToken">Token del Bot de Telegram</Label>
              <Input id="telegramBotToken" type="password" value={integrations.telegramBotToken || ''} onChange={(e) => { console.log('[IntegrationsSettingsTab] onChange telegramBotToken'); handleInputChange('integrations', 'telegramBotToken', e.target.value); }} placeholder="123456:ABC-DEF..." />
            </div>
            <div>
              <Label htmlFor="telegramChatId">Chat ID de Telegram (Opcional)</Label>
              <Input id="telegramChatId" value={integrations.telegramChatId || ''} onChange={(e) => { console.log('[IntegrationsSettingsTab] onChange telegramChatId'); handleInputChange('integrations', 'telegramChatId', e.target.value); }} placeholder="ID del chat o canal" />
            </div>
          </div>
        </section>
      </CardContent>
    </Card>
  );
};

export default IntegrationsSettingsTab;