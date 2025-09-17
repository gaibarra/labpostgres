import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Globe } from 'lucide-react';

const RegionalSettingsTab = ({ settings, handleInputChange }) => {
  const regionalSettings = settings?.regionalSettings || {};

  return (
    <Card>
      <CardHeader><CardTitle>Configuración Regional</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="currencySymbol">Símbolo de Moneda</Label>
            <Input id="currencySymbol" value={regionalSettings.currencySymbol || ''} onChange={(e) => handleInputChange('regionalSettings', 'currencySymbol', e.target.value)} />
          </div>
          <div>
            <Label htmlFor="currencyCode">Código de Moneda (ISO 4217)</Label>
            <Input id="currencyCode" value={regionalSettings.currencyCode || ''} onChange={(e) => handleInputChange('regionalSettings', 'currencyCode', e.target.value)} placeholder="Ej: USD, MXN, EUR"/>
          </div>
        </div>
        <div>
          <Label htmlFor="timezone">Zona Horaria del Sistema</Label>
          <div className="flex items-center gap-2 mt-2 p-2 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <Globe className="h-5 w-5 text-slate-500" />
            <span className="font-medium text-slate-700 dark:text-slate-300">{regionalSettings.timeZone}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            La zona horaria está estandarizada para toda la aplicación.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default RegionalSettingsTab;