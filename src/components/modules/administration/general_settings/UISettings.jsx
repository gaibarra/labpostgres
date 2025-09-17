import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from '@/components/ui/switch';

const UISettings = ({ settings, handleInputChange, handleCheckboxChange }) => {
   const uiSettings = settings?.uiSettings || {};

  return (
    <Card>
      <CardHeader><CardTitle>Preferencias de Interfaz de Usuario</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="tableDensity">Densidad de Tablas</Label>
          <Select value={uiSettings.tableDensity || 'compact'} onValueChange={(value) => handleInputChange('uiSettings', 'tableDensity', value)}>
            <SelectTrigger id="tableDensity"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="compact">Compacta</SelectItem>
              <SelectItem value="comfortable">Cómoda</SelectItem>
              <SelectItem value="spacious">Espaciada</SelectItem>
            </SelectContent>
          </Select>
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