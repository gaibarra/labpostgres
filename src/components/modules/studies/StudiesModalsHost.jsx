import React, { useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
// flushSync era usado para forzar sincronía en toggles de diálogos; lo retiramos
// para reducir riesgo de reconciliaciones intercaladas que lleven a removeChild
// sobre nodos ya movidos por Radix en modo Strict.
// import { flushSync } from 'react-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
// (Removidos imports de Card* no utilizados)
import { ScrollArea } from '@/components/ui/scroll-area';
import StudyForm from './StudyForm';
import DeleteStudyDialog from './DeleteStudyDialog';
import AIAssistDialog from './AIAssistDialog';
import AIAssistPreviewModal from './AIAssistPreviewModal';
import StudyPriceAssignmentModal from './StudyPriceAssignmentModal';
import DuplicateKeyDialog from './DuplicateKeyDialog';
// Importaciones removidas: StudyHelpDialog, Loader2 (no usados)

/**
 * Host persistente para TODOS los modales/diálogos del módulo de Estudios.
 * Evita desmontajes/portals thrash que causaban NotFoundError en transiciones.
 * Sólo cambian los props `open`. No se condiciona el JSX (excepto price modal que depende de studyForPricing).
 */
export function StudiesModalsHost({
  // Estado principal
  isFormOpen,
  setIsFormOpen,
  currentStudy,
  handleFormSubmit,
  isSubmitting,
  _loadingStudies,
  _studies,
  _studiesCount,
  _PAGE_SIZE,
  getParticularPrice,
  _studiesPage,
  _setStudiesPage,
  _totalStudiesPages,
  _searchTerm,
  _setSearchTerm,
  _onNewStudyClick,
  _onEditStudy,
  _onDeleteRequest,
  _onAssignPrices,
  _onAIAssist,
  _onHelp,
  _StudiesHeaderComponent,
  _StudiesTableComponent,
  _StudiesCardViewComponent,
  _isMobile,
  // Auxiliares
  studyToDelete,
  _setStudyToDelete,
  isDeleteConfirmOpen,
  setIsDeleteConfirmOpen,
  handleConfirmDelete,
  isAIAssistOpen,
  setIsAIAssistOpen,
  aiGeneratedData,
  setAiGeneratedData,
  isPreviewModalOpen,
  setIsPreviewModalOpen,
  handleAcceptAIPreview,
  handleCancelAIPreview,
  studyForPricing,
  setStudyForPricing,
  isPriceModalOpen,
  setIsPriceModalOpen,
  updateStudyPrices,
  referrers,
  persistParameterOrder,
  handleImmediateParameterSave,
  handleImmediateParameterDelete,
  _getParticularPriceForStudy,
  invalidHighlight,
  // Nuevo: estado de error de clave duplicada
  duplicateKeyError,
  setDuplicateKeyError,
  // Instrumentación
  enableInstrumentation = true
}) {
  // mountRef removido (no usado)
  const lastFocusRef = useRef(null);
  // Eliminado estado transitioning (se usaba para bloquear pointer-events y podía interferir con foco)
  // Eliminado flujo de parámetro IA
  const studyFormRef = useRef(null);
  const instEnabled = enableInstrumentation && (import.meta?.env?.VITE_STUDIES_DIALOG_INST === 'on');
  const appliedInertRef = useRef(new Set());

  // ===== Accesibilidad: Mitigación aria-hidden / aislamiento con inert =====
  useEffect(()=>{
    // Determinar si hay algún modal abierto relevante
  const anyOpen = isFormOpen || isDeleteConfirmOpen || isAIAssistOpen || isPreviewModalOpen || isPriceModalOpen || !!duplicateKeyError;
    if (!anyOpen) {
      // Cleanup inert previo
  appliedInertRef.current.forEach(el=>{ try { el.removeAttribute('inert'); el.removeAttribute('data-labg40-inert'); } catch(_e){ /* ignore cleanup error */ } });
      appliedInertRef.current.clear();
      return;
    }
    // Defer para permitir que Radix monte contenidos y aplique hideOthers
    const raf = requestAnimationFrame(()=>{
      try {
        // Recolectar diálogos visibles
  const dialogs = Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"]'));
  if (instEnabled) console.info('[A11Y][inert] dialogs encontrados:', dialogs.map(d=>d.getAttribute('role')));
        // Quitar aria-hidden erróneo si el foco está dentro
        dialogs.forEach(d=>{
          if (d.contains(document.activeElement) && d.getAttribute('aria-hidden') === 'true') {
            d.removeAttribute('aria-hidden');
            if (instEnabled) console.info('[A11Y][fix] aria-hidden removido de dialog activo');
          }
        });
        // Construir whitelist incluyendo cada dialog y sus ancestros hasta body (evita inert en contenedor portal personalizado)
        const whitelist = new Set();
        dialogs.forEach(d=>{
          let node = d;
            while (node && node !== document.body) {
              whitelist.add(node);
              node = node.parentNode;
            }
        });
        // Añadir explícitamente root custom si existe
        const portalRoot = document.getElementById('studies-modal-root');
        if (portalRoot) whitelist.add(portalRoot);
        const bodyChildren = Array.from(document.body.children);
        bodyChildren.forEach(node=>{
          if (whitelist.has(node)) return; // es portal o dialog
          // Evitar volver a aplicar
          if (!node.hasAttribute('inert')) {
            try {
              node.setAttribute('inert','');
              node.setAttribute('data-labg40-inert','1');
              appliedInertRef.current.add(node);
            } catch(_e){ /* ignore inert apply error */ }
          } else if (node.getAttribute('data-labg40-inert') !== '1') {
            // Si inert ajeno, no tocar
          }
        });
        // Retirar inert de nodos whitelisted si lo tienen por error
        whitelist.forEach(el=>{ if (el.hasAttribute('inert') && el.getAttribute('data-labg40-inert')==='1'){ el.removeAttribute('inert'); el.removeAttribute('data-labg40-inert'); appliedInertRef.current.delete(el);} });
      } catch(e){ /* noop */ }
    });
    return ()=> cancelAnimationFrame(raf);
  }, [isFormOpen, isDeleteConfirmOpen, isAIAssistOpen, isPreviewModalOpen, isPriceModalOpen, duplicateKeyError, instEnabled]);

  // Listener de focus para corregir aria-hidden re-aplicado dinámicamente
  useEffect(()=>{
    function onFocusIn(e){
      const el = e.target;
      if (!(el instanceof HTMLElement)) return;
      const dialog = el.closest('[role="dialog"]');
      if (dialog && dialog.getAttribute('aria-hidden') === 'true') {
        dialog.removeAttribute('aria-hidden');
        if (instEnabled) console.info('[A11Y][focus-fix] aria-hidden removido en focusin');
      }
    }
    document.addEventListener('focusin', onFocusIn, true);
    return ()=> document.removeEventListener('focusin', onFocusIn, true);
  }, [instEnabled]);

  // Cleanup total al unmount
  useEffect(()=>()=>{
    appliedInertRef.current.forEach(el=>{ try { el.removeAttribute('inert'); el.removeAttribute('data-labg40-inert'); } catch(_e){ /* ignore cleanup */ } });
    appliedInertRef.current.clear();
  },[]);

  // Utilidad de log centralizada
  const log = useCallback((evt, payload={})=>{
    if (!instEnabled) return;
    // eslint-disable-next-line no-console
    console.info(`[StudiesModalsHost][inst][${evt}]`, payload);
  }, [instEnabled]);

  // Snapshot de portales/dialogs
  const snapshotPortals = useCallback((label, extra={})=>{
    if (!instEnabled) return;
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"]')); // incluye contenidos montados
    const portals = Array.from(document.querySelectorAll('[data-radix-portal]'));
    const focusGuards = Array.from(document.querySelectorAll('[data-radix-focus-guard]'));
    log(`snapshot:${label}`, {
      ts: Date.now(),
      dialogs: dialogs.map(d=>({ tag: d.tagName, id: d.id, cls: d.className.slice(0,80) })),
      portals: portals.length,
      focusGuards: focusGuards.length,
      ...extra
    });
  }, [instEnabled, log]);

  // Throttle simple sin hooks (evita violar reglas de hooks)
  function createThrottle(interval = 120) {
    let last = 0;
    let timer = null;
    let queued = null;
    return function (fn, val) {
      const now = Date.now();
      const elapsed = now - last;
      if (elapsed >= interval) {
        last = now;
        fn(val);
      } else {
        queued = { fn, val };
        clearTimeout(timer);
        timer = setTimeout(()=>{
          if (queued) {
            last = Date.now();
            queued.fn(queued.val);
            queued = null;
          }
        }, interval - elapsed);
      }
    };
  }
  const throttleToggle = React.useMemo(()=> createThrottle(120), []);
  const safeSetFormOpen = useCallback((next)=>{
    throttleToggle((v)=>{
      // Guard: si ya está en ese estado y no estamos forzando, evita toggle redundante
      if (v === isFormOpen) { log('formDialog.toggle.skip.sameState', { to: v }); return; }
      log('formDialog.toggle.request', { to: v });
      // Snapshot previo
      snapshotPortals('before-form-toggle', { to: v });
      // Reintento si body no listo (defensivo)
      if (!document.body) {
        log('formDialog.toggle.defer.noBody', { to: v });
        return setTimeout(()=> safeSetFormOpen(v), 16);
      }
      setIsFormOpen(v);
      // Post RAF doble para detectar thrash
      requestAnimationFrame(()=> snapshotPortals('after-form-toggle-raf1', { to: v }));
      requestAnimationFrame(()=> requestAnimationFrame(()=> snapshotPortals('after-form-toggle-raf2', { to: v })));
      // Verificación tardía
      setTimeout(()=> snapshotPortals('after-form-toggle-timeout50', { to: v }), 50);
    }, next);
  }, [isFormOpen, setIsFormOpen, snapshotPortals, log, throttleToggle]);

  // Mitigación: autocorrige aria-hidden="true" en un dialog que contiene el foco (Radix a veces marca temporalmente el propio content).
  // Mantiene logging para análisis, pero opcionalmente reestablece el atributo a 'false' para evitar pérdida de accesibilidad.
    // Eliminado observer de autocorrección de aria-hidden para evitar interferir con el ciclo de hide-others de Radix.
    // (Antes aquí se forzaba aria-hidden=false cuando el foco estaba dentro del dialog.)

  // Observer para adiciones / remociones de portales (childList)
  useEffect(()=>{
    if (!instEnabled) return;
    const childMo = new MutationObserver((mutations)=>{
      let relevant = false;
      mutations.forEach(m=>{
        if (m.type === 'childList') {
          [...m.addedNodes].forEach(n=>{
            if (n.nodeType === 1 && (n.hasAttribute('data-radix-portal') || n.querySelector?.('[data-radix-portal]'))) {
              relevant = true;
              log('portal.added', { tag: n.tagName, cls: n.className });
            }
          });
          [...m.removedNodes].forEach(n=>{
            if (n.nodeType === 1 && (n.hasAttribute('data-radix-portal') || n.querySelector?.('[data-radix-portal]'))) {
              relevant = true;
              log('portal.removed', { tag: n.tagName, cls: n.className });
            }
          });
        }
      });
      if (relevant) snapshotPortals('after-portal-mutation');
    });
    childMo.observe(document.body, { childList: true, subtree: true });
    return ()=> childMo.disconnect();
  }, [instEnabled, log, snapshotPortals]);

  // Log de cambios en flags de apertura de cada modal
  useEffect(()=>{
    if (!instEnabled) return;
    const state = { isFormOpen, isDeleteConfirmOpen, isAIAssistOpen, isPreviewModalOpen, isPriceModalOpen };
    log('open-state.change', state);
    snapshotPortals('open-state-change', state);
  }, [isFormOpen, isDeleteConfirmOpen, isAIAssistOpen, isPreviewModalOpen, isPriceModalOpen, instEnabled, log, snapshotPortals]);
  useEffect(()=>{
    if (!instEnabled) return;
    snapshotPortals('mount');
    return ()=> {
      snapshotPortals('unmount');
    };
  }, [instEnabled, snapshotPortals]);

  const content = (
    <>
      {instEnabled && typeof window !== 'undefined' && (
        <div className="fixed bottom-2 right-2 z-[9999] max-w-sm text-xs font-medium text-slate-800 dark:text-slate-100 bg-amber-200 dark:bg-amber-600/70 shadow rounded px-3 py-2 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span>Diagnóstico modales activo</span>
            <button
              type="button"
              onClick={() => {
                if (window.__LABG40_SUPPRESS_REMOVECHILD_ERROR__) {
                  delete window.__LABG40_SUPPRESS_REMOVECHILD_ERROR__;
                } else {
                  window.__LABG40_SUPPRESS_REMOVECHILD_ERROR__ = true;
                }
                log('toggle.suppressRemoveChild', { active: !!window.__LABG40_SUPPRESS_REMOVECHILD_ERROR__ });
              }}
              className="px-2 py-0.5 rounded bg-slate-800/80 text-white hover:bg-slate-900 transition text-[10px]"
            >{window.__LABG40_SUPPRESS_REMOVECHILD_ERROR__ ? 'Reactivar error' : 'Suprimir error'}</button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                const evts = (window.__REMOVE_CHILD_EVENTS||[]).slice(-5);
                // eslint-disable-next-line no-console
                console.info('[domGuard][lastEvents]', evts);
                log('dump.lastEvents', { count: evts.length });
              }}
              className="px-2 py-0.5 rounded bg-sky-600 text-white hover:bg-sky-700 transition"
            >Últimos eventos</button>
            <button
              type="button"
              onClick={() => { if (window.__restoreDomGuards) window.__restoreDomGuards(); }}
              className="px-2 py-0.5 rounded bg-rose-600 text-white hover:bg-rose-700 transition"
            >Restaurar parches</button>
            <button
              type="button"
              onClick={() => {
                if (window.__LABG40_SUPPRESS_REPEAT_REMOVECHILD__) {
                  delete window.__LABG40_SUPPRESS_REPEAT_REMOVECHILD__;
                } else {
                  window.__LABG40_SUPPRESS_REPEAT_REMOVECHILD__ = true;
                }
                log('toggle.suppressRepeatRemoveChild', { active: !!window.__LABG40_SUPPRESS_REPEAT_REMOVECHILD__ });
              }}
              className="px-2 py-0.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 transition"
            >{window.__LABG40_SUPPRESS_REPEAT_REMOVECHILD__ ? 'Repetidos ON' : 'Silenciar repetidos'}</button>
            <button
              type="button"
              onClick={() => {
                if (window.__LABG40_SUPPRESS_REMOVECHILD_PREMISMATCH__) {
                  delete window.__LABG40_SUPPRESS_REMOVECHILD_PREMISMATCH__;
                } else {
                  window.__LABG40_SUPPRESS_REMOVECHILD_PREMISMATCH__ = true;
                }
                log('toggle.suppressPreMismatch', { active: !!window.__LABG40_SUPPRESS_REMOVECHILD_PREMISMATCH__ });
              }}
              className="px-2 py-0.5 rounded bg-amber-600 text-white hover:bg-amber-700 transition"
            >{window.__LABG40_SUPPRESS_REMOVECHILD_PREMISMATCH__ ? 'PreMismatch ON' : 'Silenciar preMismatch'}</button>
          </div>
          {window.__LABG40_SUPPRESS_REMOVECHILD_ERROR__ && (
            <p className="text-[10px] leading-snug opacity-80">Error NotFoundError suprimido temporalmente (riesgo: inconsistencias de foco).</p>
          )}
        </div>
      )}
      {/* Form Dialog persistente */}
      <Dialog open={isFormOpen} onOpenChange={(isOpen)=> safeSetFormOpen(isOpen)}>
        <DialogContent
          forceMount
          className={"sm:max-w-3xl bg-slate-50 dark:bg-slate-900 max-h-[90vh]"}
          // Evitar aria-hidden forzado mientras contiene foco: usar inert en hermanos cuando Radix añada aria-hidden
          ref={(el)=>{
            if (!el) return;
            // Instrumentar cambios de foco
            el.addEventListener('focusin', (e)=>{ lastFocusRef.current = e.target; log('focusin', { tag: e.target?.tagName, cls: e.target?.className?.slice(0,80) }); }, { passive: true });
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-sky-700 dark:text-sky-400">
              {currentStudy?.id ? 'Editar Estudio' : 'Registrar Nuevo Estudio'}
            </DialogTitle>
            <DialogDescription>
              Completa los detalles del estudio a continuación.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[75vh] p-4">
            <StudyForm
              ref={studyFormRef}
              initialStudy={currentStudy}
              onSubmit={handleFormSubmit}
              onAIAssist={()=>{ 
            // Cerrar y abrir otro diálogo en el mismo frame puede producir estados intermedios donde
            // Radix marca temporalmente aria-hidden. Diferimos la apertura al próximo tick.
            safeSetFormOpen(false); 
            setTimeout(()=> setIsAIAssistOpen(true), 0); 
          }}
              onCancel={()=> safeSetFormOpen(false)}
              getParticularPriceForStudy={getParticularPrice}
              isSubmitting={isSubmitting}
              onImmediateParameterSave={handleImmediateParameterSave}
              onImmediateParameterDelete={handleImmediateParameterDelete}
              onPersistParameterOrder={persistParameterOrder}
              invalidHighlight={invalidHighlight}
            />
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog persistente */}
      <DeleteStudyDialog
        isOpen={isDeleteConfirmOpen}
        onOpenChange={setIsDeleteConfirmOpen}
        studyToDelete={studyToDelete}
        onConfirmDelete={handleConfirmDelete}
        isSubmitting={isSubmitting}
      />

      {/* AI Assist Dialog persistente */}
      <AIAssistDialog
        isOpen={isAIAssistOpen}
        onOpenChange={setIsAIAssistOpen}
        onGenerationSuccess={(data)=>{
          setAiGeneratedData(data);
          setIsAIAssistOpen(false);
          setIsPreviewModalOpen(true);
        }}
      />

      {/* Preview Modal persistente */}
      <AIAssistPreviewModal
        isOpen={isPreviewModalOpen}
        onOpenChange={setIsPreviewModalOpen}
        studyData={aiGeneratedData}
        onAccept={handleAcceptAIPreview}
        onCancel={handleCancelAIPreview}
      />

      {/* Price Assignment Modal persistente */}
      <StudyPriceAssignmentModal
        isOpen={isPriceModalOpen}
        onOpenChange={(open)=>{ 
          setIsPriceModalOpen(open); 
          if (!open) setStudyForPricing(null); 
        }}
        study={studyForPricing || {}}
        referrers={referrers}
        onUpdatePrices={updateStudyPrices}
        isSubmitting={isSubmitting}
      />

      {/* Duplicate Key Modal persistente */}
      <DuplicateKeyDialog
        isOpen={!!duplicateKeyError}
        onOpenChange={(open)=>{ if (!open) setDuplicateKeyError(null); }}
        field={duplicateKeyError?.field}
        value={duplicateKeyError?.value}
      />
    </>
  );

  // Portal estable: evita ser desmontado por ErrorBoundary de Studies
  let portalRoot = null;
  if (typeof document !== 'undefined') {
    // Memoización simple: no recrear en mismo render loop
    portalRoot = document.getElementById('studies-modal-root');
    if (!portalRoot) {
      const existing = document.querySelectorAll('#studies-modal-root');
      if (existing.length === 0) {
        portalRoot = document.createElement('div');
        portalRoot.id = 'studies-modal-root';
        document.body.appendChild(portalRoot);
        log('portalRoot.created.dynamically', { reason: 'missing in DOM at render time' });
      } else {
        portalRoot = existing[0];
        log('portalRoot.reused.raceDetected', { count: existing.length });
      }
    }
  }

  // Integridad del portal root (detección de duplicados / reparenting accidental)
  useEffect(()=>{
    if (!instEnabled) return;
    function checkIntegrity(label) {
      const nodes = document.querySelectorAll('#studies-modal-root');
      if (nodes.length !== 1) {
        log('portalRoot.anomaly.count', { label, count: nodes.length });
      }
      const node = nodes[0];
      if (node && node.parentNode !== document.body) {
        log('portalRoot.anomaly.parent', { label, parentTag: node.parentNode?.tagName });
      }
    }
    checkIntegrity('mount');
    const interval = setInterval(()=> checkIntegrity('interval'), 5000);
    return ()=> clearInterval(interval);
  }, [instEnabled, log]);

  return portalRoot ? createPortal(content, portalRoot) : content;
}

export default StudiesModalsHost;
