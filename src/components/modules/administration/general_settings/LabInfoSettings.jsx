import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, Image as ImageIcon, XCircle, AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { apiClient } from '@/lib/apiClient';

const LabInfoSettings = ({ settings, handleInputChange }) => {
  const { toast } = useToast();
  const labInfo = settings?.labInfo || {};
  const uiSettings = settings?.uiSettings || {};
  const [isUploading, setIsUploading] = useState(false);
  const [logoHint] = useState('PNG transparente o SVG recomendado. Tamaño ideal: máximo 240px alto, <= 600px ancho, fondo transparente, peso < 300KB.');
  const [dimensionWarning, setDimensionWarning] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const RECOMMENDED_MAX_HEIGHT = 240; // px
  const RECOMMENDED_MAX_WIDTH = 600; // px
  const HARD_MAX_SIZE_MB = 2; // MB backend limit
  const SOFT_TARGET_BYTES = 300 * 1024; // 300KB target

  const optimizeImageIfNeeded = (file) => new Promise((resolve) => {
    if (!file.type.startsWith('image/') || file.size <= SOFT_TARGET_BYTES) return resolve(file);
    const img = new Image();
    const reader = new FileReader();
    reader.onload = e => { img.src = e.target.result; };
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, Math.sqrt(SOFT_TARGET_BYTES / file.size));
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(b => { if (b && b.size < file.size) { resolve(new File([b], file.name.replace(/\.(png|jpg|jpeg)$/i,'-opt.png'), { type: 'image/png' })); } else { resolve(file); } }, 'image/png', 0.92);
      } catch { resolve(file); }
    };
    reader.readAsDataURL(file);
  });

  const validateDimensions = (file) => new Promise((resolve) => {
    if (!file.type.startsWith('image/')) return resolve(file);
    const img = new Image();
    const reader = new FileReader();
    reader.onload = e => { img.src = e.target.result; };
    img.onload = () => {
      const w = img.width, h = img.height;
      let warn = '';
      if (h > RECOMMENDED_MAX_HEIGHT || w > RECOMMENDED_MAX_WIDTH) {
        warn = `Dimensiones grandes (${w}x${h}). Se recomienda <= ${RECOMMENDED_MAX_WIDTH}x${RECOMMENDED_MAX_HEIGHT}px para evitar PDF pesado.`;
      }
      const ratio = (w/h).toFixed(2);
      if (ratio < 0.5 || ratio > 4) {
        warn += (warn ? ' ' : '') + `Proporción inusual (ratio ${ratio}). Ideal entre 0.5 y 4 para buena escala.`;
      }
      setDimensionWarning(warn);
      resolve(file);
    };
    reader.readAsDataURL(file);
  });

  const processAndUpload = async (file) => {
    if (!file) return;
    if (file.size > HARD_MAX_SIZE_MB * 1024 * 1024) { // hard 2MB limit
      toast({
        title: "Archivo demasiado grande",
        description: "El logo no debe pesar más de 2MB.",
        variant: "destructive",
      });
      return;
    }
    setIsUploading(true);
    try {
      await validateDimensions(file);
      const optimized = await optimizeImageIfNeeded(file);
      const formData = new FormData();
      formData.append('file', optimized);
      const data = await apiClient.post('/uploads/logo', formData);
      const { url } = data || {};
      handleInputChange('uiSettings', 'logoUrl', url);
      toast({ title: '¡Logo subido!', description: optimized !== file ? 'Se optimizó y subió correctamente.' : 'Se subió correctamente.' });
    } catch (error) {
      toast({ title: 'Error al subir el logo', description: error.message, variant: 'destructive' });
    } finally { setIsUploading(false); }
  };

  const handleLogoUpload = async (event) => {
    const file = event.target.files[0];
    processAndUpload(file);
  };

  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation(); setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processAndUpload(e.dataTransfer.files[0]);
    }
  };
  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); };
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); };

  const removeLogo = () => {
  // Quitar logo desde uiSettings para evitar tocar labInfo
  handleInputChange('uiSettings', 'logoUrl', '');
    toast({
      title: "Logo eliminado",
      description: "Se ha quitado la URL del logo. Guarda los cambios para confirmar.",
    });
  };

  return (
    <Card>
      <CardHeader><CardTitle>Información General, Fiscal y de Contacto</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        <section>
          <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-3">Información General y Fiscal</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="labName">Nombre Comercial del Laboratorio</Label>
              <Input id="labName" value={labInfo.name || ''} onChange={(e) => handleInputChange('labInfo', 'name', e.target.value)} placeholder="Ej: Laboratorio Clínico Central" />
            </div>
            <div>
              <Label htmlFor="razonSocial">Razón Social</Label>
              <Input id="razonSocial" value={labInfo.razonSocial || ''} onChange={(e) => handleInputChange('labInfo', 'razonSocial', e.target.value)} placeholder="Ej: Servicios de Salud Integrales S.A. de C.V." />
            </div>
            <div>
              <Label htmlFor="labTaxId">RFC / ID Fiscal</Label>
              <Input id="labTaxId" value={labInfo.taxId || ''} onChange={(e) => handleInputChange('labInfo', 'taxId', e.target.value)} placeholder="Ej: SSI010101XYZ" />
            </div>
            <div>
              <Label>Logo del Laboratorio</Label>
              <div className="flex items-center gap-4">
                <div
                  className={"w-24 h-24 rounded-md border flex items-center justify-center bg-slate-50 dark:bg-slate-800 relative overflow-hidden " + (dragActive ? 'ring-2 ring-sky-500' : '')}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                >
                  {(uiSettings.logoUrl || labInfo.logoUrl) ? (
                    <img src={uiSettings.logoUrl || labInfo.logoUrl} alt="Logo del Laboratorio" className="object-contain w-full h-full rounded-md" />
                  ) : (
                    <ImageIcon className="w-10 h-10 text-slate-400" />
                  )}
                  {dimensionWarning && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[10px] text-white px-1 py-0.5 line-clamp-2">
                      <AlertTriangle className="inline-block w-3 h-3 mr-1" />{dimensionWarning}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <Button asChild variant="outline" disabled={isUploading}>
                    <Label className="cursor-pointer">
                      {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                      {isUploading ? 'Subiendo...' : 'Subir Logo'}
                      <Input type="file" className="sr-only" onChange={handleLogoUpload} accept="image/png, image/jpeg, image/svg+xml" disabled={isUploading} />
                    </Label>
                  </Button>
                  {(uiSettings.logoUrl || labInfo.logoUrl) && (
                    <Button variant="ghost" size="icon" onClick={removeLogo} className="ml-2 text-red-500 hover:text-red-700">
                      <XCircle className="h-5 w-5" />
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">{logoHint}</p>
                  <p className="text-[10px] text-slate-500 mt-1">Consejos: usa fondo transparente, evita texto muy pequeño, mantén un padding interno para no cortar bordes.</p>
                  <p className="text-[10px] text-slate-500">Si tu imagen pesa más de 300KB intentaremos comprimirla automáticamente.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
        
        <section>
          <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-3">Dirección Fiscal</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="calle">Calle</Label>
              <Input id="calle" value={labInfo.calle || ''} onChange={(e) => handleInputChange('labInfo', 'calle', e.target.value)} placeholder="Ej: Av. Reforma" />
            </div>
            <div>
              <Label htmlFor="numeroExterior">Número Exterior</Label>
              <Input id="numeroExterior" value={labInfo.numeroExterior || ''} onChange={(e) => handleInputChange('labInfo', 'numeroExterior', e.target.value)} placeholder="Ej: 123" />
            </div>
            <div>
              <Label htmlFor="numeroInterior">Número Interior / Depto.</Label>
              <Input id="numeroInterior" value={labInfo.numeroInterior || ''} onChange={(e) => handleInputChange('labInfo', 'numeroInterior', e.target.value)} placeholder="Ej: A, 101 (Opcional)" />
            </div>
            <div>
              <Label htmlFor="colonia">Colonia</Label>
              <Input id="colonia" value={labInfo.colonia || ''} onChange={(e) => handleInputChange('labInfo', 'colonia', e.target.value)} placeholder="Ej: Centro" />
            </div>
            <div>
              <Label htmlFor="codigoPostal">Código Postal</Label>
              <Input id="codigoPostal" value={labInfo.codigoPostal || ''} onChange={(e) => handleInputChange('labInfo', 'codigoPostal', e.target.value)} placeholder="Ej: 06500" />
            </div>
            <div>
              <Label htmlFor="ciudad">Ciudad / Municipio</Label>
              <Input id="ciudad" value={labInfo.ciudad || ''} onChange={(e) => handleInputChange('labInfo', 'ciudad', e.target.value)} placeholder="Ej: Ciudad de México" />
            </div>
            <div>
              <Label htmlFor="estado">Estado</Label>
              <Input id="estado" value={labInfo.estado || ''} onChange={(e) => handleInputChange('labInfo', 'estado', e.target.value)} placeholder="Ej: CDMX" />
            </div>
            <div>
              <Label htmlFor="pais">País</Label>
              <Input id="pais" value={labInfo.pais || 'México'} onChange={(e) => handleInputChange('labInfo', 'pais', e.target.value)} disabled />
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-3">Información de Contacto y Responsable Sanitario</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="labPhone">Teléfono Principal</Label>
              <Input id="labPhone" type="tel" value={labInfo.phone || ''} onChange={(e) => handleInputChange('labInfo', 'phone', e.target.value)} placeholder="Ej: 55 1234 5678" />
            </div>
            <div>
              <Label htmlFor="secondaryPhone">Teléfono Secundario (Opcional)</Label>
              <Input id="secondaryPhone" type="tel" value={labInfo.secondaryPhone || ''} onChange={(e) => handleInputChange('labInfo', 'secondaryPhone', e.target.value)} placeholder="Ej: 55 8765 4321" />
            </div>
            <div>
              <Label htmlFor="labEmail">Email de Contacto</Label>
              <Input id="labEmail" type="email" value={labInfo.email || ''} onChange={(e) => handleInputChange('labInfo', 'email', e.target.value)} placeholder="Ej: contacto@laboratorio.com" />
            </div>
            <div>
              <Label htmlFor="labWebsite">Sitio Web</Label>
              <Input id="labWebsite" type="url" value={labInfo.website || ''} onChange={(e) => handleInputChange('labInfo', 'website', e.target.value)} placeholder="https://ejemplo.com" />
            </div>
            <div>
              <Label htmlFor="responsableSanitarioNombre">Nombre del Responsable Sanitario</Label>
              <Input id="responsableSanitarioNombre" value={labInfo.responsableSanitarioNombre || ''} onChange={(e) => handleInputChange('labInfo', 'responsableSanitarioNombre', e.target.value)} placeholder="Ej: Dr. Juan Pérez" />
            </div>
            <div>
              <Label htmlFor="responsableSanitarioCedula">Cédula Profesional del Responsable</Label>
              <Input id="responsableSanitarioCedula" value={labInfo.responsableSanitarioCedula || ''} onChange={(e) => handleInputChange('labInfo', 'responsableSanitarioCedula', e.target.value)} placeholder="Ej: 1234567" />
            </div>
          </div>
        </section>
      </CardContent>
    </Card>
  );
};

export default LabInfoSettings;