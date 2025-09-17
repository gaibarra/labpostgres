import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from "@/components/ui/use-toast";
import { motion } from 'framer-motion';
import { UploadCloud, Save, Info, Mail, MessageSquare, Send } from 'lucide-react';
import { useSettings } from '@/contexts/SettingsContext';

// This legacy Settings component is now wired to SettingsContext to persist via backend.
// Prefer using Administration > General Settings. This remains for backward routes.

const Settings = () => {
  const { toast } = useToast();
  const { settings: ctxSettings, updateSettings } = useSettings();
  const [settings, setSettings] = useState({
    labName: '', labLogoPreview: '', rfc: '', razonSocial: '', calle: '', numeroExterior: '', numeroInterior: '', colonia: '', codigoPostal: '', ciudad: '', estado: '', pais: 'México', telefonoPrincipal: '', telefonoSecundario: '', emailContacto: '', responsableSanitarioNombre: '', responsableSanitarioCedula: '', openAIKey: '', deepseekKey: '', perplexityKey: '', emailServiceProvider: '', emailApiUser: '', emailApiKey: '', whatsappApiUrl: '', whatsappApiKey: '', telegramBotToken: '', telegramChatId: ''
  });
  const [labLogoFile, setLabLogoFile] = useState(null);


  useEffect(() => {
    // Initialize from SettingsContext to show current saved values
    if (!ctxSettings) return;
    const s = ctxSettings;
    const legacyLike = {
      labName: s.labInfo?.name || '',
      labLogoPreview: s.labInfo?.logoUrl || '',
      rfc: s.labInfo?.taxId || '',
      razonSocial: s.labInfo?.razonSocial || '',
      calle: s.labInfo?.calle || '',
      numeroExterior: s.labInfo?.numeroExterior || '',
      numeroInterior: s.labInfo?.numeroInterior || '',
      colonia: s.labInfo?.colonia || '',
      codigoPostal: s.labInfo?.codigoPostal || '',
      ciudad: s.labInfo?.ciudad || '',
      estado: s.labInfo?.estado || '',
      pais: s.labInfo?.pais || 'México',
      telefonoPrincipal: s.labInfo?.phone || '',
      telefonoSecundario: s.labInfo?.secondaryPhone || '',
      emailContacto: s.labInfo?.email || '',
      responsableSanitarioNombre: s.labInfo?.responsableSanitarioNombre || '',
      responsableSanitarioCedula: s.labInfo?.responsableSanitarioCedula || '',
      openAIKey: s.integrations?.openaiApiKey || '',
      deepseekKey: s.integrations?.deepseekKey || '',
      perplexityKey: s.integrations?.perplexityKey || '',
      emailServiceProvider: s.integrations?.emailServiceProvider || '',
      emailApiUser: s.integrations?.emailApiUser || '',
      emailApiKey: s.integrations?.emailApiKey || '',
      whatsappApiUrl: s.integrations?.whatsappApiUrl || '',
      whatsappApiKey: s.integrations?.whatsappApiKey || '',
      telegramBotToken: s.integrations?.telegramBotToken || '',
      telegramChatId: s.integrations?.telegramChatId || ''
    };
    setSettings(prevSettings => ({ ...prevSettings, ...legacyLike }));
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setSettings({ ...settings, [name]: value });
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setLabLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setSettings({ ...settings, labLogoPreview: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      labInfo: {
        name: settings.labName,
        logoUrl: settings.labLogoPreview,
        taxId: settings.rfc,
        razonSocial: settings.razonSocial,
        calle: settings.calle,
        numeroExterior: settings.numeroExterior,
        numeroInterior: settings.numeroInterior,
        colonia: settings.colonia,
        codigoPostal: settings.codigoPostal,
        ciudad: settings.ciudad,
        estado: settings.estado,
        pais: settings.pais,
        phone: settings.telefonoPrincipal,
        secondaryPhone: settings.telefonoSecundario,
        email: settings.emailContacto,
        responsableSanitarioNombre: settings.responsableSanitarioNombre,
        responsableSanitarioCedula: settings.responsableSanitarioCedula,
      },
      integrations: {
        openaiApiKey: settings.openAIKey,
        deepseekKey: settings.deepseekKey,
        perplexityKey: settings.perplexityKey,
        emailServiceProvider: settings.emailServiceProvider,
        emailApiUser: settings.emailApiUser,
        emailApiKey: settings.emailApiKey,
        whatsappApiUrl: settings.whatsappApiUrl,
        whatsappApiKey: settings.whatsappApiKey,
        telegramBotToken: settings.telegramBotToken,
        telegramChatId: settings.telegramChatId,
      }
    };
    try {
      await updateSettings(payload);
      toast({ title: '¡Configuración Guardada!', description: 'Se guardó en el servidor correctamente.' });
    } catch (err) {
      toast({ title: 'Error al guardar', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="pb-8"
    >
      <form onSubmit={handleSubmit}>
        <Card className="max-w-4xl mx-auto shadow-xl glass-card">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-sky-700 dark:text-sky-400">Configuración General del Laboratorio</CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400">
              Completa la información de tu laboratorio y configura las integraciones.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            
            <section>
              <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-4 border-b pb-2 flex items-center">
                <Info className="mr-2 h-5 w-5 text-sky-600 dark:text-sky-400" /> Información General y Fiscal
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="labName" className="text-slate-700 dark:text-slate-300">Nombre Comercial del Laboratorio</Label>
                  <Input id="labName" name="labName" value={settings.labName} onChange={handleInputChange} placeholder="Ej: Laboratorio Clínico Central" className="bg-white/80 dark:bg-slate-800/80" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="razonSocial" className="text-slate-700 dark:text-slate-300">Razón Social</Label>
                  <Input id="razonSocial" name="razonSocial" value={settings.razonSocial} onChange={handleInputChange} placeholder="Ej: Servicios de Salud Integrales S.A. de C.V." className="bg-white/80 dark:bg-slate-800/80" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rfc" className="text-slate-700 dark:text-slate-300">RFC</Label>
                  <Input id="rfc" name="rfc" value={settings.rfc} onChange={handleInputChange} placeholder="Ej: SSI010101XYZ" className="bg-white/80 dark:bg-slate-800/80" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="labLogo" className="text-slate-700 dark:text-slate-300">Logo del Laboratorio</Label>
                  <div className="flex items-center space-x-4">
                    {settings.labLogoPreview && (
                      <img-replace src={settings.labLogoPreview} alt="Vista previa del logo" className="h-20 w-20 rounded-md object-cover border border-slate-300 dark:border-slate-600" />
                    )}
                    <Button type="button" variant="outline" className="relative">
                      <UploadCloud className="mr-2 h-4 w-4" />
                      Subir Logo
                      <Input id="labLogo" type="file" accept="image/*" onChange={handleLogoChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    </Button>
                  </div>
                  {labLogoFile && <p className="text-xs text-muted-foreground">{labLogoFile.name}</p>}
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-3">Dirección Fiscal</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="calle" className="text-slate-700 dark:text-slate-300">Calle</Label>
                  <Input id="calle" name="calle" value={settings.calle} onChange={handleInputChange} placeholder="Ej: Av. Reforma" className="bg-white/80 dark:bg-slate-800/80" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="numeroExterior" className="text-slate-700 dark:text-slate-300">Número Exterior</Label>
                  <Input id="numeroExterior" name="numeroExterior" value={settings.numeroExterior} onChange={handleInputChange} placeholder="Ej: 123" className="bg-white/80 dark:bg-slate-800/80" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="numeroInterior" className="text-slate-700 dark:text-slate-300">Número Interior / Depto.</Label>
                  <Input id="numeroInterior" name="numeroInterior" value={settings.numeroInterior} onChange={handleInputChange} placeholder="Ej: A, 101 (Opcional)" className="bg-white/80 dark:bg-slate-800/80" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="colonia" className="text-slate-700 dark:text-slate-300">Colonia</Label>
                  <Input id="colonia" name="colonia" value={settings.colonia} onChange={handleInputChange} placeholder="Ej: Centro" className="bg-white/80 dark:bg-slate-800/80" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="codigoPostal" className="text-slate-700 dark:text-slate-300">Código Postal</Label>
                  <Input id="codigoPostal" name="codigoPostal" value={settings.codigoPostal} onChange={handleInputChange} placeholder="Ej: 06500" className="bg-white/80 dark:bg-slate-800/80" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ciudad" className="text-slate-700 dark:text-slate-300">Ciudad / Municipio</Label>
                  <Input id="ciudad" name="ciudad" value={settings.ciudad} onChange={handleInputChange} placeholder="Ej: Ciudad de México" className="bg-white/80 dark:bg-slate-800/80" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estado" className="text-slate-700 dark:text-slate-300">Estado</Label>
                  <Input id="estado" name="estado" value={settings.estado} onChange={handleInputChange} placeholder="Ej: CDMX" className="bg-white/80 dark:bg-slate-800/80" />
                </div>
                 <div className="space-y-2">
                  <Label htmlFor="pais" className="text-slate-700 dark:text-slate-300">País</Label>
                  <Input id="pais" name="pais" value={settings.pais} onChange={handleInputChange} className="bg-white/80 dark:bg-slate-800/80" disabled />
                </div>
              </div>
            </section>
            
            <section>
              <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-3">Información de Contacto y Responsable Sanitario</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="telefonoPrincipal" className="text-slate-700 dark:text-slate-300">Teléfono Principal</Label>
                  <Input id="telefonoPrincipal" name="telefonoPrincipal" type="tel" value={settings.telefonoPrincipal} onChange={handleInputChange} placeholder="Ej: 55 1234 5678" className="bg-white/80 dark:bg-slate-800/80" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefonoSecundario" className="text-slate-700 dark:text-slate-300">Teléfono Secundario (Opcional)</Label>
                  <Input id="telefonoSecundario" name="telefonoSecundario" type="tel" value={settings.telefonoSecundario} onChange={handleInputChange} placeholder="Ej: 55 8765 4321" className="bg-white/80 dark:bg-slate-800/80" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emailContacto" className="text-slate-700 dark:text-slate-300">Email de Contacto</Label>
                  <Input id="emailContacto" name="emailContacto" type="email" value={settings.emailContacto} onChange={handleInputChange} placeholder="Ej: contacto@laboratorio.com" className="bg-white/80 dark:bg-slate-800/80" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="responsableSanitarioNombre" className="text-slate-700 dark:text-slate-300">Nombre del Responsable Sanitario</Label>
                  <Input id="responsableSanitarioNombre" name="responsableSanitarioNombre" value={settings.responsableSanitarioNombre} onChange={handleInputChange} placeholder="Ej: Dr. Juan Pérez" className="bg-white/80 dark:bg-slate-800/80" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="responsableSanitarioCedula" className="text-slate-700 dark:text-slate-300">Cédula Profesional del Responsable</Label>
                  <Input id="responsableSanitarioCedula" name="responsableSanitarioCedula" value={settings.responsableSanitarioCedula} onChange={handleInputChange} placeholder="Ej: 1234567" className="bg-white/80 dark:bg-slate-800/80" />
                </div>
              </div>
            </section>

            <section>
                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-4 border-b pb-2 flex items-center">
                    <Info className="mr-2 h-5 w-5 text-sky-600 dark:text-sky-400" /> API Keys de Inteligencia Artificial
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Introduce tus claves API para habilitar funciones de asistencia por IA.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="openAIKey" className="text-slate-700 dark:text-slate-300">OpenAI API Key</Label>
                        <Input id="openAIKey" name="openAIKey" type="password" value={settings.openAIKey} onChange={handleInputChange} placeholder="sk-..." className="bg-white/80 dark:bg-slate-800/80" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="deepseekKey" className="text-slate-700 dark:text-slate-300">Deepseek API Key</Label>
                        <Input id="deepseekKey" name="deepseekKey" type="password" value={settings.deepseekKey} onChange={handleInputChange} placeholder="dk-..." className="bg-white/80 dark:bg-slate-800/80" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="perplexityKey" className="text-slate-700 dark:text-slate-300">Perplexity API Key</Label>
                        <Input id="perplexityKey" name="perplexityKey" type="password" value={settings.perplexityKey} onChange={handleInputChange} placeholder="pplx-..." className="bg-white/80 dark:bg-slate-800/80" />
                    </div>
                </div>
            </section>

            <section>
                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-4 border-b pb-2 flex items-center">
                    <Mail className="mr-2 h-5 w-5 text-sky-600 dark:text-sky-400" /> Configuración de Envío de Email
                </h2>
                 <p className="text-sm text-muted-foreground mb-4">
                  Configura tu proveedor de servicios de email para notificaciones automáticas.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="emailServiceProvider" className="text-slate-700 dark:text-slate-300">Proveedor de Email (Ej: SendGrid, Mailgun)</Label>
                        <Input id="emailServiceProvider" name="emailServiceProvider" value={settings.emailServiceProvider} onChange={handleInputChange} placeholder="SendGrid" className="bg-white/80 dark:bg-slate-800/80" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="emailApiUser" className="text-slate-700 dark:text-slate-300">Usuario/ID de API Email</Label>
                        <Input id="emailApiUser" name="emailApiUser" value={settings.emailApiUser} onChange={handleInputChange} placeholder="usuario_api" className="bg-white/80 dark:bg-slate-800/80" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="emailApiKey" className="text-slate-700 dark:text-slate-300">Clave API Email</Label>
                        <Input id="emailApiKey" name="emailApiKey" type="password" value={settings.emailApiKey} onChange={handleInputChange} placeholder="SG.xxxxxxxx" className="bg-white/80 dark:bg-slate-800/80" />
                    </div>
                </div>
            </section>
            
            <section>
                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-4 border-b pb-2 flex items-center">
                    <MessageSquare className="mr-2 h-5 w-5 text-sky-600 dark:text-sky-400" /> Configuración de WhatsApp (API)
                </h2>
                 <p className="text-sm text-muted-foreground mb-4">
                  Para enviar mensajes por WhatsApp, necesitarás una API (Ej: Twilio API for WhatsApp, Meta Cloud API).
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="whatsappApiUrl" className="text-slate-700 dark:text-slate-300">URL de la API de WhatsApp</Label>
                        <Input id="whatsappApiUrl" name="whatsappApiUrl" value={settings.whatsappApiUrl} onChange={handleInputChange} placeholder="https://api.provider.com/whatsapp/..." className="bg-white/80 dark:bg-slate-800/80" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="whatsappApiKey" className="text-slate-700 dark:text-slate-300">Token/Clave API de WhatsApp</Label>
                        <Input id="whatsappApiKey" name="whatsappApiKey" type="password" value={settings.whatsappApiKey} onChange={handleInputChange} placeholder="Tu clave API" className="bg-white/80 dark:bg-slate-800/80" />
                    </div>
                </div>
            </section>

            <section>
                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-4 border-b pb-2 flex items-center">
                    <Send className="mr-2 h-5 w-5 text-sky-600 dark:text-sky-400" /> Configuración de Telegram (Bot)
                </h2>
                 <p className="text-sm text-muted-foreground mb-4">
                  Configura tu bot de Telegram para enviar notificaciones.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="telegramBotToken" className="text-slate-700 dark:text-slate-300">Token del Bot de Telegram</Label>
                        <Input id="telegramBotToken" name="telegramBotToken" type="password" value={settings.telegramBotToken} onChange={handleInputChange} placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11" className="bg-white/80 dark:bg-slate-800/80" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="telegramChatId" className="text-slate-700 dark:text-slate-300">Chat ID de Telegram (Opcional, para notificaciones generales)</Label>
                        <Input id="telegramChatId" name="telegramChatId" value={settings.telegramChatId} onChange={handleInputChange} placeholder="ID del chat o canal" className="bg-white/80 dark:bg-slate-800/80" />
                    </div>
                </div>
            </section>


          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full md:w-auto ml-auto bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 text-white text-lg py-3 px-6">
              <Save className="mr-2 h-5 w-5" />
              Guardar Toda la Configuración
            </Button>
          </CardFooter>
        </Card>
      </form>
    </motion.div>
  );
};

export default Settings;