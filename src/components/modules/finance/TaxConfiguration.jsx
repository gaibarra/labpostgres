import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { motion } from 'framer-motion';
import { Percent, Save, Loader2, Building } from 'lucide-react';
import { useSettings } from '@/contexts/SettingsContext';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { logAuditEvent } from '@/lib/auditUtils';

const TaxConfiguration = () => {
  const { settings, setSettings, updateSettings, isLoading } = useSettings();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSaving, setIsSaving] = React.useState(false);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === 'checkbox' ? checked : value;
    setSettings(prev => ({
      ...prev,
      taxSettings: {
        ...prev.taxSettings,
        [name]: type === 'number' ? parseFloat(val) || 0 : val
      }
    }));
  };
  
  const handleSelectChange = (name, value) => {
    setSettings(prev => ({
        ...prev,
        taxSettings: {
            ...prev.taxSettings,
            [name]: value
        }
    }));
  };

  const handleSwitchChange = (name, checked) => {
    setSettings(prev => ({
      ...prev,
      taxSettings: {
        ...prev.taxSettings,
        [name]: checked
      }
    }));
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      await updateSettings(settings);
      toast({ title: "Éxito", description: "Configuración de impuestos guardada correctamente." });
      await logAuditEvent('Finanzas:ConfiguracionImpuestosActualizada', { settings: settings.taxSettings }, user?.id);
    } catch (error) {
      toast({ title: "Error", description: `No se pudo guardar la configuración: ${error.message}`, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const regimenesFiscales = [
    { value: "601", label: "601 - General de Ley Personas Morales" },
    { value: "603", label: "603 - Personas Morales con Fines no Lucrativos" },
    { value: "605", label: "605 - Sueldos y Salarios e Ingresos Asimilados a Salarios" },
    { value: "606", label: "606 - Arrendamiento" },
    { value: "612", label: "612 - Personas Físicas con Actividades Empresariales y Profesionales" },
    { value: "614", label: "614 - Ingresos por intereses" },
    { value: "616", label: "616 - Sin obligaciones fiscales" },
    { value: "621", label: "621 - Incorporación Fiscal" },
    { value: "626", label: "626 - Régimen Simplificado de Confianza" },
  ];

  if (isLoading || !settings?.taxSettings) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-green-500" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="shadow-xl glass-card overflow-hidden">
        <CardHeader className="bg-gradient-to-br from-green-50 via-teal-50 to-cyan-50 dark:from-green-900/70 dark:via-teal-900/70 dark:to-cyan-900/70 p-6">
          <div className="flex items-center">
            <Percent className="h-10 w-10 mr-4 text-green-600 dark:text-green-400" />
            <div>
              <CardTitle className="text-3xl font-bold text-green-700 dark:text-green-300">
                Configuración de Impuestos
              </CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400">
                Define las tasas de impuestos y la información fiscal para la facturación.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-slate-50 dark:bg-slate-800/60 shadow-md">
              <CardHeader>
                <CardTitle className="text-xl flex items-center text-slate-700 dark:text-slate-200">
                  <Percent className="h-5 w-5 mr-2 text-green-500" />
                  Impuestos Principales
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ivaRate">Tasa de IVA (%)</Label>
                  <Input 
                    id="ivaRate" 
                    name="ivaRate" 
                    type="number" 
                    value={settings.taxSettings.ivaRate} 
                    onChange={handleInputChange} 
                    placeholder="16"
                    className="bg-white dark:bg-slate-700"
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm bg-white dark:bg-slate-700">
                  <div className="space-y-0.5">
                    <Label htmlFor="pricesIncludeIva">¿Los precios de estudios/paquetes ya incluyen IVA?</Label>
                    <p className="text-[0.8rem] text-muted-foreground">
                      Actívalo si los precios que defines son los precios finales al cliente.
                    </p>
                  </div>
                  <Switch
                    id="pricesIncludeIva"
                    name="pricesIncludeIva"
                    checked={settings.taxSettings.pricesIncludeIva}
                    onCheckedChange={(checked) => handleSwitchChange('pricesIncludeIva', checked)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-50 dark:bg-slate-800/60 shadow-md">
              <CardHeader>
                <CardTitle className="text-xl flex items-center text-slate-700 dark:text-slate-200">
                  <Building className="h-5 w-5 mr-2 text-indigo-500" />
                  Información Fiscal
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="regimenFiscal">Régimen Fiscal (SAT)</Label>
                  <SearchableSelect
                    value={settings.taxSettings.regimenFiscal}
                    onValueChange={(value) => handleSelectChange('regimenFiscal', value)}
                    options={regimenesFiscales.map(reg => ({ value: reg.value, label: reg.label }))}
                    placeholder="Selecciona un régimen"
                    searchPlaceholder="Buscar régimen..."
                    emptyText="Sin opciones"
                  />
                </div>
                 <p className="text-sm text-muted-foreground">
                   La información de Razón Social y RFC se configura en <span className="font-semibold">Administración &gt; Configuración General &gt; Info. Lab</span>.
                </p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end p-6">
          <Button onClick={handleSaveChanges} disabled={isSaving || isLoading} className="bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700 text-white">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {isSaving ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
};

export default TaxConfiguration;