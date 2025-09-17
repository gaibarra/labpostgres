import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X } from 'lucide-react';

const OrderLabelsPreviewModal = ({ isOpen, onOpenChange, order }) => {

    const handlePrint = () => {
        if (order?.id) {
            window.open(`/print/order-labels/${order.id}`, '_blank');
        }
    };
    
    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md bg-slate-50 dark:bg-slate-900 flex flex-col">
                <DialogHeader>
                    <DialogTitle className="text-sky-700 dark:text-sky-400">Imprimir Etiquetas</DialogTitle>
                    <DialogDescription>
                        Se abrirá una nueva pestaña para imprimir las etiquetas de la orden {order?.folio}.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex-grow my-4 flex items-center justify-center">
                    <Printer className="h-20 w-20 text-slate-300 dark:text-slate-600" />
                </div>
                <DialogFooter className="flex-col sm:flex-row sm:justify-end gap-2">
                     <DialogClose asChild>
                        <Button variant="outline" className="w-full sm:w-auto">
                            <X className="mr-2 h-4 w-4" /> Cerrar
                        </Button>
                    </DialogClose>
                    <Button onClick={handlePrint} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">
                        <Printer className="mr-2 h-4 w-4" /> Continuar a Impresión
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default OrderLabelsPreviewModal;