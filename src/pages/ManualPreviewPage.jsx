import React, { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Printer, ArrowLeft } from 'lucide-react';
import UserManualContent from '@/components/UserManualContent';

const ManualPreviewPage = () => {
  const componentRef = useRef();
  const navigate = useNavigate();

  const handlePrint = useReactToPrint({
    content: () => componentRef.current,
    documentTitle: 'LabSys - Manual de Usuario',
  });

  return (
    <div className="bg-slate-100 dark:bg-slate-900 min-h-screen">
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm shadow-sm">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-200">Previsualización del Manual de Usuario</h1>
            <div className="flex items-center space-x-4">
              <Button variant="outline" onClick={() => navigate(-1)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver
              </Button>
              <Button onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />
                Imprimir / Guardar como PDF
              </Button>
            </div>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-slate-950 shadow-lg rounded-lg overflow-hidden">
          <UserManualContent ref={componentRef} />
        </div>
      </main>
    </div>
  );
};

export default ManualPreviewPage;