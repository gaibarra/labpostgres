import React, { useEffect, useState } from 'react';
  import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
  import { Button } from '@/components/ui/button';
  import { Loader2, FileText } from 'lucide-react';
  import { loadJsPdf } from '@/lib/dynamicImports';

    const ReferrerPriceListPDFModal = ({ isOpen, onOpenChange, referrer, studies, packagesData }) => {
      const [pdfUrl, setPdfUrl] = useState('');
      const [isLoading, setIsLoading] = useState(false);

      useEffect(() => {
        if (!(isOpen && referrer && studies && packagesData)) return undefined;
        let isMounted = true;
        let objectUrl = null;
        const generatePriceList = async () => {
          setIsLoading(true);
          try {
            const { jsPDF, autoTable } = await loadJsPdf();
            if (!isMounted) return;
            const doc = new jsPDF();
            doc.setFontSize(18);
            doc.text(`Lista de Precios: ${referrer.name}`, 14, 22);
            doc.setFontSize(11);
            doc.setTextColor(100);

            const studyData = (referrer.listaprecios?.studies || [])
              .map(priceItem => {
                const study = studies.find(s => s.id === priceItem.itemId);
                return study ? [study.clave, study.name, `$${parseFloat(priceItem.price).toFixed(2)}`] : null;
              })
              .filter(Boolean);

            const packageData = (referrer.listaprecios?.packages || [])
              .map(priceItem => {
                const pkg = packagesData.find(p => p.id === priceItem.itemId);
                return pkg ? [pkg.name, `$${parseFloat(priceItem.price).toFixed(2)}`] : null;
              })
              .filter(Boolean);

            let startY = 30;

            if (studyData.length > 0) {
              doc.setFontSize(14);
              doc.text("Estudios", 14, startY);
              startY += 6;
              autoTable(doc, {
                startY,
                head: [['Clave', 'Nombre', 'Precio']],
                body: studyData,
                theme: 'striped',
                headStyles: { fillColor: [41, 128, 185] },
              });
              startY = doc.lastAutoTable.finalY + 10;
            }

            if (packageData.length > 0) {
              doc.setFontSize(14);
              doc.text("Paquetes", 14, startY);
              startY += 6;
              autoTable(doc, {
                startY,
                head: [['Nombre', 'Precio']],
                body: packageData,
                theme: 'striped',
                headStyles: { fillColor: [41, 128, 185] },
              });
            }

            if (studyData.length === 0 && packageData.length === 0) {
              doc.setFontSize(12);
              doc.text("Este referente no tiene precios asignados.", 14, 40);
            }

            const pdfBlob = doc.output('blob');
            objectUrl = URL.createObjectURL(pdfBlob);
            setPdfUrl(objectUrl);
          } catch (error) {
            console.error("Error generating PDF:", error);
            setPdfUrl('');
          } finally {
            if (isMounted) setIsLoading(false);
          }
        };

        generatePriceList();

        return () => {
          isMounted = false;
          if (objectUrl) {
            try { URL.revokeObjectURL(objectUrl); } catch (_) { /* ignore */ }
          }
        };
      }, [isOpen, referrer, studies, packagesData]);

      return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
          <DialogContent className="sm:max-w-4xl h-[90vh] flex flex-col bg-slate-50 dark:bg-slate-900">
            <DialogHeader>
              <DialogTitle className="flex items-center text-sky-700 dark:text-sky-400">
                <FileText className="h-6 w-6 mr-2"/>
                Vista Previa: Lista de Precios - {referrer?.name}
              </DialogTitle>
              <DialogDescription>
                Previsualización del PDF con la lista de precios. Puedes descargarlo o imprimirlo desde el visor.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-grow my-4 border rounded-md overflow-hidden bg-slate-200 dark:bg-slate-800">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
                  <p className="ml-2">Generando PDF...</p>
                </div>
              ) : pdfUrl ? (
                <iframe src={pdfUrl} className="w-full h-full" title={`Lista de Precios ${referrer?.name}`} />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p>No se pudo generar la vista previa del PDF.</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );
    };

    export default ReferrerPriceListPDFModal;