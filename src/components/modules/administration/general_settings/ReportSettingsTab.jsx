import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import SearchableSelect from '@/components/ui/SearchableSelect';
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
            <SearchableSelect
              options={['dd/MM/yyyy','MM/dd/yyyy','yyyy-MM-dd'].map(f=>({value:f,label:f}))}
              value={reportSettings.dateFormat || 'dd/MM/yyyy'}
              onValueChange={(value) => handleInputChange('reportSettings', 'dateFormat', value)}
              placeholder="Selecciona formato..."
              searchPlaceholder="Buscar formato..."
              notFoundMessage="Sin formatos"
            />
          </div>
          <div>
            <Label htmlFor="timeFormat">Formato de Hora</Label>
            <SearchableSelect
              options={[
                {value:'HH:mm',label:'24 Horas (HH:mm)'},
                {value:'hh:mm a',label:'12 Horas (hh:mm a)'}
              ]}
              value={reportSettings.timeFormat || 'HH:mm'}
              onValueChange={(value) => handleInputChange('reportSettings', 'timeFormat', value)}
              placeholder="Selecciona formato..."
              searchPlaceholder="Buscar formato..."
              notFoundMessage="Sin formatos"
            />
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