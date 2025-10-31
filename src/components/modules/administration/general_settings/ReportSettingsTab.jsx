import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from '@/components/ui/switch';

const ReportSettingsTab = ({ settings, handleInputChange, handleCheckboxChange }) => {
  const reportSettings = settings?.reportSettings || {};

  return (
    <Card>
      <CardHeader><CardTitle>Configuración de Reportes</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="dateFormat">Formato de Fecha</Label>
            <Select value={reportSettings.dateFormat || 'dd/MM/yyyy'} onValueChange={(value) => handleInputChange('reportSettings', 'dateFormat', value)}>
              <SelectTrigger id="dateFormat"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dd/MM/yyyy">dd/MM/yyyy</SelectItem>
                <SelectItem value="MM/dd/yyyy">MM/dd/yyyy</SelectItem>
                <SelectItem value="yyyy-MM-dd">yyyy-MM-dd</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="timeFormat">Formato de Hora</Label>
            <Select value={reportSettings.timeFormat || 'HH:mm'} onValueChange={(value) => handleInputChange('reportSettings', 'timeFormat', value)}>
              <SelectTrigger id="timeFormat"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="HH:mm">24 Horas (HH:mm)</SelectItem>
                <SelectItem value="hh:mm a">12 Horas (hh:mm a)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="reportHeader">Encabezado por Defecto (Reportes)</Label>
          <Textarea id="reportHeader" value={reportSettings.defaultHeader || ''} onChange={(e) => handleInputChange('reportSettings', 'defaultHeader', e.target.value)} />
        </div>
        <div>
          <Label htmlFor="reportFooter">Pie de Página por Defecto (Reportes)</Label>
          <Textarea id="reportFooter" value={reportSettings.defaultFooter || ''} onChange={(e) => handleInputChange('reportSettings', 'defaultFooter', e.target.value)} />
        </div>
        <div className="flex items-center space-x-2 pt-2">
          <Switch 
            id="showLogoInReport" 
            checked={!!reportSettings.showLogoInReport} 
            onCheckedChange={(checked) => handleCheckboxChange('reportSettings', 'showLogoInReport', checked)}
          />
          <Label htmlFor="showLogoInReport" className="cursor-pointer">Mostrar logo en reportes</Label>
        </div>
        <div className="flex items-center space-x-2 pt-2">
          <Switch 
            id="logoAlignCenter" 
            checked={!!reportSettings.logoAlignCenter} 
            onCheckedChange={(checked) => handleCheckboxChange('reportSettings', 'logoAlignCenter', checked)}
          />
          <Label htmlFor="logoAlignCenter" className="cursor-pointer">Centrar logo en el encabezado del PDF</Label>
        </div>
        <div className="flex items-center space-x-2 pt-2">
          <Switch 
            id="compactByDefault" 
            checked={reportSettings.compactByDefault !== false} 
            onCheckedChange={(checked) => handleCheckboxChange('reportSettings', 'compactByDefault', checked)}
          />
          <Label htmlFor="compactByDefault" className="cursor-pointer">Activar modo compacto por defecto (ahorra papel)</Label>
        </div>
      </CardContent>
    </Card>
  );
};

export default ReportSettingsTab;