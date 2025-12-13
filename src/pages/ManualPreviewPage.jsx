import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Printer, ArrowLeft } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import UserManualContent from '@/components/UserManualContent';

const ManualPreviewPage = () => {
  const componentRef = useRef(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const collectStyles = () => {
    try {
      return Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
        .map(node => node.outerHTML)
        .join('\n');
    } catch (error) {
      console.warn('[ManualPreview] styles copy failed', error);
      return '';
    }
  };

  const handlePrint = () => {
    const node = componentRef.current;
    if (!node) {
      toast({ title: 'Manual no disponible', description: 'Actualiza la vista e inténtalo nuevamente.', variant: 'destructive' });
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.top = '0';
    iframe.style.left = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      toast({ title: 'No se pudo preparar la impresión', description: 'Refresca la página e inténtalo de nuevo.', variant: 'destructive' });
      return;
    }

    const styles = collectStyles();
    const html = `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>LabG40 - Manual de Usuario</title>
          ${styles}
          <style>
            *, *::before, *::after { box-sizing: border-box; }
            body { margin: 0; padding: 32px; background: #f1f5f9; font-family: 'Inter', 'Segoe UI', Arial, sans-serif; }
            .manual-wrapper { max-width: 1120px; margin: 0 auto; background: #fff; color: #020617; border-radius: 28px; padding: 48px 56px; box-shadow: 0 25px 70px rgba(15, 23, 42, 0.08); }
            @media print {
              body { padding: 0; background: #fff; }
              .manual-wrapper { box-shadow: none; border-radius: 0; padding: 24px 36px; }
            }
          </style>
        </head>
        <body>
          <div class="manual-wrapper">${node.outerHTML}</div>
        </body>
      </html>`;

    doc.open();
    doc.write(html);
    doc.close();

    const cleanup = () => {
      setTimeout(() => {
        iframe.parentNode && iframe.parentNode.removeChild(iframe);
      }, 500);
    };

    const triggerPrint = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (error) {
        console.warn('[ManualPreview] iframe print failed', error);
        toast({ title: 'No se pudo abrir la impresión', description: 'Usa Ctrl/Cmd + P como alternativa.', variant: 'destructive' });
      } finally {
        cleanup();
      }
    };

    if (iframe.contentWindow?.document?.readyState === 'complete') {
      triggerPrint();
    } else {
      iframe.onload = triggerPrint;
      setTimeout(triggerPrint, 600);
    }
  };

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