import React from 'react';
import { Button } from '@/components/ui/button';
import { DialogClose } from "@/components/ui/dialog";
import { Printer, Mail, Send, XCircle, Sparkles } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';

const ReportFooter = ({ order, generatePDF, handleSendAction, onOpenChange, onAIAssist }) => {
  return (
    <div className="w-full flex flex-col sm:flex-row flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2 flex-wrap justify-center sm:justify-start">
          <Button variant="outline" onClick={() => handleSendAction('Email')} className="text-blue-600 border-blue-500 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-400 dark:hover:bg-blue-900/40 text-xs px-3 py-1.5 h-auto">
            <Mail className="mr-1.5 h-3.5 w-3.5" /> Email
          </Button>
          <Button variant="outline" onClick={() => handleSendAction('WhatsApp')} className="text-green-600 border-green-500 hover:bg-green-50 dark:text-green-400 dark:border-green-400 dark:hover:bg-green-900/40 text-xs px-3 py-1.5 h-auto flex items-center">
            <FaWhatsapp className="mr-1.5 h-4 w-4" /> WhatsApp
          </Button>
          <Button variant="outline" onClick={() => handleSendAction('Telegram')} className="text-sky-500 border-sky-500 hover:bg-sky-50 dark:text-sky-400 dark:border-sky-400 dark:hover:bg-sky-900/40 text-xs px-3 py-1.5 h-auto">
            <Send className="mr-1.5 h-3.5 w-3.5" /> Telegram
          </Button>
        </div>
        <div className="flex gap-2 flex-wrap justify-center sm:justify-end">
          <Button 
            variant="outline" 
            onClick={onAIAssist} 
            className="text-purple-600 border-purple-500 hover:bg-purple-50 dark:text-purple-400 dark:border-purple-400 dark:hover:bg-purple-900/40 text-xs px-3 py-1.5 h-auto"
          >
            <Sparkles className="mr-2 h-4 w-4" /> Asistente IA
          </Button>
          <Button 
            variant="default" 
            onClick={generatePDF} 
            className="bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-700 hover:to-cyan-700 text-white text-xs px-4 py-2 h-auto shadow-md hover:shadow-lg transition-shadow"
          >
            <Printer className="mr-2 h-4 w-4" /> Imprimir / Guardar PDF
          </Button>
          <DialogClose asChild>
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700 text-xs px-3 py-1.5 h-auto">
                <XCircle className="mr-1.5 h-4 w-4"/> Cerrar
            </Button>
          </DialogClose>
        </div>
    </div>
  );
};

export default ReportFooter;