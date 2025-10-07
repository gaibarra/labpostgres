import React from 'react';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
    import { Button } from '@/components/ui/button';
    import { ScrollArea } from '@/components/ui/scroll-area';
    import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
    import { Badge } from '@/components/ui/badge';
    import { Sparkles } from 'lucide-react';

    const AIAssistPreviewModal = ({ isOpen, onOpenChange, studyData, onAccept, onCancel }) => {
      if (!studyData) return null;

      return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col bg-slate-50 dark:bg-slate-900">
            <DialogHeader>
              <DialogTitle className="flex items-center text-purple-600 dark:text-purple-400 gap-2">
                <Sparkles className="h-5 w-5" />
                Previsualización de Datos Generados por IA
                {studyData?.ai_meta && (
                  <Badge variant={studyData.ai_meta.source === 'mock-fallback' ? 'destructive' : 'secondary'} className="ml-2">
                    {studyData.ai_meta.source === 'mock-fallback' ? 'SIMULADO' : 'REAL'}
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription>
                Revisa los datos generados. Si son correctos, acéptalos para cargarlos en el formulario.
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-grow pr-6 -mr-6">
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold text-slate-700 dark:text-slate-300">Nombre del Estudio</h4>
                    <p>{studyData.name}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-700 dark:text-slate-300">Categoría</h4>
                    <div><Badge variant="secondary">{studyData.category}</Badge></div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-700 dark:text-slate-300">Tipo de Muestra</h4>
                    <p className="text-sm">{studyData.sample_type || <span className="italic opacity-60">(No provisto)</span>}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-700 dark:text-slate-300">Contenedor</h4>
                    <p className="text-sm">{studyData.sample_container || <span className="italic opacity-60">(No provisto)</span>}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-700 dark:text-slate-300">Tiempo de Proceso (h)</h4>
                    <p className="text-sm">{studyData.processing_time_hours != null ? studyData.processing_time_hours : <span className="italic opacity-60">(No provisto)</span>}</p>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-700 dark:text-slate-300">Descripción</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{studyData.description}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-700 dark:text-slate-300">Indicaciones para el Paciente</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{studyData.indications}</p>
                </div>
                
                <div>
                  <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-2">Parámetros y Valores de Referencia</h4>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader className="bg-slate-100 dark:bg-slate-800">
                        <TableRow>
                          <TableHead>Parámetro</TableHead>
                          <TableHead>Unidades</TableHead>
                          <TableHead>Valores de Referencia</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {studyData.parameters && studyData.parameters.map((param, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{param.name}</TableCell>
                            <TableCell>{param.unit}</TableCell>
                            <TableCell>
                              <ul className="list-disc list-inside space-y-1 text-xs">
                                {param.valorReferencia && param.valorReferencia.filter(vr => !(vr.valorMin == null && vr.valorMax == null)).map((vr, vrIndex) => (
                                  <li key={vrIndex}>
                                    <strong>{vr.sexo} ({vr.edadMin}-{vr.edadMax} {vr.unidadEdad}):</strong> {vr.valorMin != null ? vr.valorMin : ''}{(vr.valorMin != null && vr.valorMax != null)?' - ': (vr.valorMax != null && vr.valorMin == null ? '≤':'')}{vr.valorMax != null ? vr.valorMax : ''}
                                  </li>
                                ))}
                                {param.valorReferencia && !param.valorReferencia.some(vr => vr.valorMin != null || vr.valorMax != null) && (
                                  <li className="italic opacity-70 list-none">(Sin valores cuantitativos definidos; revise antes de guardar)</li>
                                )}
                              </ul>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </ScrollArea>
            <DialogFooter className="pt-4 border-t border-slate-200 dark:border-slate-700">
              <Button variant="outline" onClick={onCancel}>Cancelar</Button>
              <Button onClick={onAccept} className="bg-purple-500 hover:bg-purple-600 text-white">
                Aceptar y Usar Datos
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );
    };

    export default AIAssistPreviewModal;