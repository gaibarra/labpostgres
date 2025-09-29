import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Wand2, Download, Eye } from 'lucide-react';
import AIAssistEmailDialog from './AIAssistEmailDialog';

const TemplateFormDialog = ({ isOpen, onOpenChange, onSave, mode, initialData }) => {
  const [currentTemplate, setCurrentTemplate] = useState(initialData);
  const [guidePreview, setGuidePreview] = useState(initialData?.guide || '');
  const [showGuidePreview, setShowGuidePreview] = useState(false);
  const [lastAIMeta, setLastAIMeta] = useState(null);
  const [isAIAssistOpen, setIsAIAssistOpen] = useState(false);

  useEffect(() => {
    setCurrentTemplate(initialData);
  }, [initialData, isOpen]);

  const handleSave = () => {
    onSave(currentTemplate);
  };
  
  const handleAIContentGenerated = ({ subject, body, guide, _meta }) => {
    setCurrentTemplate(prev => ({
      ...prev,
      subject,
      body,
      guide: guide || prev.guide
    }));
    if (guide) setGuidePreview(guide);
    if (_meta) setLastAIMeta(_meta);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{mode === 'new' ? 'Nueva Plantilla de Email' : 'Editar Plantilla'}</DialogTitle>
            <DialogDescription className="sr-only">
              Formulario para {mode === 'new' ? 'crear una nueva' : 'editar la'} plantilla de email incluyendo nombre, asunto y cuerpo del mensaje.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(90vh-200px)] pr-5">
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="templateName">Nombre Plantilla</Label>
                <Input id="templateName" value={currentTemplate.name} onChange={(e) => setCurrentTemplate({ ...currentTemplate, name: e.target.value })} />
              </div>
              <div className="relative">
                <Label htmlFor="templateSubject">Asunto</Label>
                <Input id="templateSubject" value={currentTemplate.subject} onChange={(e) => setCurrentTemplate({ ...currentTemplate, subject: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="templateBody">Cuerpo del Email (placeholder: {'{{nombre_suscriptor}}'})</Label>
                <Textarea id="templateBody" value={currentTemplate.body} onChange={(e) => setCurrentTemplate({ ...currentTemplate, body: e.target.value })} rows={10} />
                <p className="mt-1 text-[11px] text-muted-foreground">Puedes usar {'{{nombre_suscriptor}}'} para personalizar el saludo.</p>
              </div>
              { (currentTemplate.guide || guidePreview) && (
                <div className="mt-2 border rounded p-3 bg-slate-50 dark:bg-slate-800/40">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="m-0">Guía Generada</Label>
                    <div className="flex items-center gap-2">
                      {lastAIMeta?.usedFallback && <span className="text-[10px] px-2 py-0.5 rounded bg-amber-200 text-amber-900">Fallback</span>}
                      <Button type="button" variant="outline" size="sm" onClick={() => {
                        navigator.clipboard.writeText(currentTemplate.guide || guidePreview || '');
                      }}>Copiar Guía</Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => {
                        const md = (currentTemplate.guide || guidePreview || '').startsWith('{') ? (()=>{ try { const g=JSON.parse(currentTemplate.guide||guidePreview); const secs = (g.sections||[]).map(s=>`\n\n## ${s.heading}\n${s.content}`).join(''); return `# ${g.title}\n\n${g.intro||''}${secs}\n\n**${g.cta||''}**`; } catch { return currentTemplate.guide || guidePreview || ''; } })() : (currentTemplate.guide || guidePreview || '');
                        const blob = new Blob([md], { type:'text/markdown' });
                        const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`guia_${currentTemplate.name||'email'}.md`; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),500);
                      }}>MD</Button>
                      <Button type="button" variant="outline" size="sm" onClick={()=> setShowGuidePreview(p=>!p)}><Eye className="h-3 w-3" /></Button>
                      <Button type="button" variant="outline" size="sm" onClick={async () => {
                        const { default: jsPDF } = await import('jspdf');
                        const raw = currentTemplate.guide || guidePreview || '';
                        let gObj = null;
                        let md = raw;
                        if (raw.startsWith('{')) {
                          try { gObj = JSON.parse(raw); } catch {}
                        }
                        if (gObj) {
                          const secs = (gObj.sections||[]).map(s=>`\n\n${s.heading.toUpperCase()}\n${s.content}`).join('');
                          md = `${gObj.title || ''}\n\n${gObj.intro||''}${secs}\n\n${gObj.cta||''}`;
                        }
                        const doc = new jsPDF('p','pt','a4');
                        const wrap = (text)=> {
                          const maxWidth = 500; const lineHeight=14; let y=60; doc.setFontSize(12);
                          const paragraphs = text.split(/\n+/);
                          paragraphs.forEach(p=>{ if(!p.trim()){ y+=lineHeight; return;} const words=p.split(/\s+/); let line=''; words.forEach(w=>{ const test=line? line+' '+w : w; const wWidth = doc.getTextWidth(test); if (wWidth>maxWidth){ doc.text(line,50,y); y+=lineHeight; line=w; } else { line=test; } }); if(line){ doc.text(line,50,y); y+=lineHeight; } y+=lineHeight/2; });
                        };
                        doc.setFontSize(18); doc.text((gObj?.title)||'Guía', 50,40);
                        wrap(md.replace(/\r/g,''));
                        doc.save(`guia_${currentTemplate.name||'email'}.pdf`);
                      }}><Download className="h-3 w-3" /></Button>
                    </div>
                  </div>
                  <Textarea rows={8} value={currentTemplate.guide || guidePreview} onChange={(e)=> setCurrentTemplate(prev=>({...prev, guide: e.target.value }))} />
                  <div className="mt-1 text-[10px] text-muted-foreground">La guía se guardará en un campo separado.</div>
                  {showGuidePreview && (
                    <div className="mt-3 p-3 rounded border bg-white dark:bg-slate-900 prose prose-sm max-w-none overflow-y-auto max-h-64">
                      {(() => {
                        const raw = currentTemplate.guide || guidePreview || '';
                        let gObj=null; if (raw.startsWith('{')) { try { gObj=JSON.parse(raw); } catch {} }
                        if (gObj) {
                          return (
                            <div>
                              <h2>{gObj.title}</h2>
                              <p>{gObj.intro}</p>
                              {(gObj.sections||[]).map((s,i)=>(<div key={i}><h3>{s.heading}</h3><p>{s.content}</p></div>))}
                              <p><strong>{gObj.cta}</strong></p>
                            </div>
                          );
                        }
                        // naive markdown headings render
                        const md = raw
                          .replace(/^### (.*$)/gim,'<h3>$1</h3>')
                          .replace(/^## (.*$)/gim,'<h2>$1</h2>')
                          .replace(/^# (.*$)/gim,'<h1>$1</h1>')
                          .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
                          .replace(/\n\n/g,'<br/><br/>' );
                        return <div dangerouslySetInnerHTML={{ __html: md }} />;
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
          <DialogFooter className="flex justify-between w-full">
            <Button variant="outline" onClick={() => setIsAIAssistOpen(true)} className="mr-auto">
              <Wand2 className="mr-2 h-4 w-4 text-purple-500" />
              Asistente IA
            </Button>
            <div>
              <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
              <Button onClick={handleSave} className="ml-2">Guardar Plantilla</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AIAssistEmailDialog
        open={isAIAssistOpen}
        onOpenChange={setIsAIAssistOpen}
        onContentGenerated={handleAIContentGenerated}
      />
    </>
  );
};

export default TemplateFormDialog;