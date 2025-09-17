import React, { useState } from 'react';
// Supabase removed: seeding page deprecated. Future seeding should use backend scripts.
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { motion, AnimatePresence } from 'framer-motion';
import { Database, Trash2, Play, AlertTriangle, CheckCircle } from 'lucide-react';

const firstNames = ["José", "María", "Juan", "Guadalupe", "Francisco", "Juana", "Antonio", "Margarita", "Jesús", "Sofía", "Miguel", "Verónica"];
const lastNames = ["Hernández", "García", "Martínez", "López", "González", "Pérez", "Rodríguez", "Sánchez", "Ramírez", "Flores", "Gómez", "Díaz"];
const streetNames = ["Revolución", "Independencia", "Juárez", "Hidalgo", "Morelos", "Zaragoza", "Obregón", "Madero"];

const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];
const getRandomDate = (start, end) => new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
const getRandomNumber = (min, max) => Math.random() * (max - min) + min;

const studyDefinitions = [
  { 
    name: 'Biometría Hemática Completa', category: 'Hematología', price: 150,
    parameters: [
      { name: 'Hemoglobina', unit: 'g/dL', ranges: [{ sex: 'Ambos', age_min:0, age_max: 120, lower: 12, upper: 16 }]},
      { name: 'Hematocrito', unit: '%', ranges: [{ sex: 'Ambos', age_min:0, age_max: 120, lower: 36, upper: 48 }]},
      { name: 'Leucocitos', unit: 'x10³/μL', ranges: [{ sex: 'Ambos', age_min:0, age_max: 120, lower: 4.5, upper: 11 }]},
    ]
  },
  {
    name: 'Química Sanguínea (6 elementos)', category: 'Química Clínica', price: 250,
    parameters: [
      { name: 'Glucosa', unit: 'mg/dL', ranges: [{ sex: 'Ambos', age_min:0, age_max: 120, lower: 70, upper: 100 }]},
      { name: 'Urea', unit: 'mg/dL', ranges: [{ sex: 'Ambos', age_min:0, age_max: 120, lower: 17, upper: 43 }]},
      { name: 'Creatinina', unit: 'mg/dL', ranges: [{ sex: 'Ambos', age_min:0, age_max: 120, lower: 0.6, upper: 1.2 }]},
      { name: 'Ácido Úrico', unit: 'mg/dL', ranges: [{ sex: 'Ambos', age_min:0, age_max: 120, lower: 2.5, upper: 7 }]},
      { name: 'Colesterol Total', unit: 'mg/dL', ranges: [{ sex: 'Ambos', age_min:0, age_max: 120, lower: 0, upper: 200 }]},
      { name: 'Triglicéridos', unit: 'mg/dL', ranges: [{ sex: 'Ambos', age_min:0, age_max: 120, lower: 0, upper: 150 }]},
    ]
  },
  {
    name: 'Perfil Tiroideo', category: 'Hormonas', price: 400,
    parameters: [
        { name: 'TSH', unit: 'μIU/mL', ranges: [{ sex: 'Ambos', age_min:0, age_max: 120, lower: 0.4, upper: 4.2 }]},
        { name: 'T4 Libre', unit: 'ng/dL', ranges: [{ sex: 'Ambos', age_min:0, age_max: 120, lower: 0.8, upper: 1.8 }]},
        { name: 'T3 Total', unit: 'ng/dL', ranges: [{ sex: 'Ambos', age_min:0, age_max: 120, lower: 80, upper: 200 }]},
    ]
  }
];

const packageDefinitions = [
    { name: 'Paquete Básico', price: 350, studies: ['Biometría Hemática Completa', 'Química Sanguínea (6 elementos)'] },
    { name: 'Chequeo Completo', price: 700, studies: ['Biometría Hemática Completa', 'Química Sanguínea (6 elementos)', 'Perfil Tiroideo'] },
];

const DevDataSeederPage = () => {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const addLog = (message, type = 'info') => {
    const iconMap = {
      info: <Database size={16} className="text-blue-500" />,
      success: <CheckCircle size={16} className="text-green-500" />,
      error: <AlertTriangle size={16} className="text-red-500" />,
      warning: <Trash2 size={16} className="text-orange-500" />
    };
    setLogs(prev => [...prev, { message, type, icon: iconMap[type] || iconMap.info, timestamp: new Date().toLocaleTimeString() }]);
  };
  
  const handleClearData = async () => {
    addLog('Limpieza deshabilitada (Supabase eliminado)', 'warning');
    toast({ title: 'No disponible', description: 'Funcionalidad de limpieza deshabilitada.', variant: 'destructive' });
  };

  const handleSeedData = async () => {
    addLog('Seeding deshabilitado (Supabase eliminado)', 'warning');
    toast({ title: 'No disponible', description: 'Funcionalidad de seeding deshabilitada.', variant: 'destructive' });
  };


  return (
    <div className="p-4 md:p-8 space-y-8 bg-slate-50 dark:bg-slate-900 min-h-screen">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Card className="shadow-lg border-sky-200 dark:border-sky-800 bg-white dark:bg-slate-800/50">
          <CardHeader>
            <div className="flex items-center space-x-4">
              <Database className="w-10 h-10 text-sky-500" />
              <div>
                <CardTitle className="text-3xl font-bold text-slate-800 dark:text-slate-100">Herramienta de Datos de Prueba</CardTitle>
                <CardDescription className="text-slate-600 dark:text-slate-400">
                  Usa esta página para poblar tu base de datos con datos de prueba o para limpiarla.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Button onClick={handleSeedData} disabled={isLoading} className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-6 text-lg rounded-lg shadow-md hover:shadow-lg transition-all transform hover:scale-105">
              <Play className="mr-2 h-5 w-5" />
              {isLoading ? 'Poblando...' : 'Poblar Base de Datos'}
            </Button>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isLoading} className="bg-red-600 hover:bg-red-700 text-white font-bold py-6 text-lg rounded-lg shadow-md hover:shadow-lg transition-all transform hover:scale-105">
                  <Trash2 className="mr-2 h-5 w-5" />
                  {isLoading ? 'Limpiando...' : 'Limpiar Datos de Prueba'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción no se puede deshacer. Esto eliminará permanentemente los datos de prueba de las tablas seleccionadas en tu base de datos.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearData} className="bg-red-600 hover:bg-red-700">Sí, limpiar datos</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
        <Card className="shadow-md border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
          <CardHeader>
            <CardTitle>Registro de Actividad</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-72 w-full rounded-md border p-4 bg-slate-100 dark:bg-slate-800 font-mono text-sm">
              <AnimatePresence>
              {logs.map((log, index) => (
                <motion.div 
                    key={index} 
                    className="flex items-center space-x-3 mb-1"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    {log.icon}
                    <span className="text-slate-400">{log.timestamp}</span>
                    <p className={`flex-1 ${log.type === 'error' ? 'text-red-500' : log.type === 'success' ? 'text-green-500' : 'text-slate-700 dark:text-slate-300'}`}>
                      {log.message}
                    </p>
                </motion.div>
              ))}
              </AnimatePresence>
            </ScrollArea>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default DevDataSeederPage;