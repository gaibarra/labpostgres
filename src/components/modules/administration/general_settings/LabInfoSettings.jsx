import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, Image as ImageIcon, XCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { apiClient } from '@/lib/apiClient';

const LabInfoSettings = ({ settings, handleInputChange }) => {
  const { toast } = useToast();
  const labInfo = settings?.labInfo || {};
  const [isUploading, setIsUploading] = useState(false);

  const handleLogoUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) { // 2MB limit
      toast({
        title: "Archivo demasiado grande",
        description: "El logo no debe pesar más de 2MB.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      // Placeholder: backend upload endpoint to implement
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/uploads/logo', { method: 'POST', body: formData });
      if (!response.ok) throw new Error('Error subiendo logo');
      const { url } = await response.json();
      handleInputChange('labInfo', 'logoUrl', url);
      toast({ title: '¡Logo subido!', description: 'El logo se ha actualizado correctamente.' });
    } catch (error) {
      toast({ title: 'Error al subir el logo', description: error.message, variant: 'destructive' });
    } finally { setIsUploading(false); }
  };

  const removeLogo = () => {
    handleInputChange('labInfo', 'logoUrl', '');
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
                <div className="w-20 h-20 rounded-md border flex items-center justify-center bg-slate-50 dark:bg-slate-800">
                  {labInfo.logoUrl ? (
                    <img-replace src={labInfo.logoUrl} alt="Logo del Laboratorio" className="object-contain w-full h-full rounded-md" />
                  ) : (
                    <ImageIcon className="w-10 h-10 text-slate-400" />
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
                  {labInfo.logoUrl && (
                    <Button variant="ghost" size="icon" onClick={removeLogo} className="ml-2 text-red-500 hover:text-red-700">
                      <XCircle className="h-5 w-5" />
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG, SVG. Máx 2MB.</p>
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