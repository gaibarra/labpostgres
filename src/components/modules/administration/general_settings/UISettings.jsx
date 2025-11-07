import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { Switch } from '@/components/ui/switch';

const UISettings = ({ settings, handleInputChange, handleCheckboxChange }) => {
   const uiSettings = settings?.uiSettings || {};

  return (
    <Card>
      <CardHeader><CardTitle>Preferencias de Interfaz de Usuario</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="uiLogoUrl">URL del Logo (UI y PDF)</Label>
          <Input id="uiLogoUrl" value={uiSettings.logoUrl || ''} onChange={(e) => handleInputChange('uiSettings', 'logoUrl', e.target.value)} placeholder="/branding/hematos.logo.pdf.png" />
          <p className="text-xs text-muted-foreground mt-1">Si está vacío y existe labInfo.logoUrl, se usará ese valor.</p>
        </div>
        <div className="flex items-center space-x-2 pt-2">
           <Switch 
            id="logoIncludesLabName" 
            checked={!!uiSettings.logoIncludesLabName} 
            onCheckedChange={(checked) => handleCheckboxChange('uiSettings', 'logoIncludesLabName', checked)} 
          />
          <Label htmlFor="logoIncludesLabName" className="cursor-pointer">El logo ya incluye el nombre del laboratorio</Label>
        </div>
        <div>
          <Label htmlFor="tableDensity">Densidad de Tablas</Label>
          <SearchableSelect
            options={[
              {value:'compact',label:'Compacta'},
              {value:'comfortable',label:'Cómoda'},
              {value:'spacious',label:'Espaciada'}
            ]}
            value={uiSettings.tableDensity || 'compact'}
            onValueChange={(value) => handleInputChange('uiSettings', 'tableDensity', value)}
            placeholder="Selecciona densidad..."
            searchPlaceholder="Buscar densidad..."
            notFoundMessage="Sin opciones"
          />
        </div>
        <div>
          <Label htmlFor="notificationsDuration">Duración Notificaciones (ms)</Label>
          <Input id="notificationsDuration" type="number" value={uiSettings.notificationsDefaultDuration || 5000} onChange={(e) => handleInputChange('uiSettings', 'notificationsDefaultDuration', parseInt(e.target.value, 10) || 0)} />
        </div>
        <div className="flex items-center space-x-2 pt-2">
           <Switch 
            id="autoSaveDrafts" 
            checked={!!uiSettings.autoSaveDrafts} 
            onCheckedChange={(checked) => handleCheckboxChange('uiSettings', 'autoSaveDrafts', checked)} 
          />
          <Label htmlFor="autoSaveDrafts" className="cursor-pointer">Guardar borradores automáticamente (donde aplique)</Label>
        </div>
      </CardContent>
    </Card>
  );
};

export default UISettings;