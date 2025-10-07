// Dev-only DOM guards & diagnostics for elusive NotFoundError (removeChild)
// This file is loaded only in development (see conditional import in main.jsx)
// It monkey-patches Element.prototype.removeChild to capture contextual data
// whenever React / Radix triggers a removal of a node that is no longer a child
// of its claimed parent (classic 'The node to be removed is not a child of this node').
//
// Goals:
// 1. Log structured diagnostics (parent/child descriptors, siblings snapshot, stack)
// 2. Provide a toggle to optionally suppress throwing (to keep app usable while investigating)
// 3. Offer a restore function to revert the patch quickly (window.__restoreRemoveChild())
//
// IMPORTANT: We DO NOT suppress errors by default; set
//   window.__LABG40_SUPPRESS_REMOVECHILD_ERROR__ = true
// in DevTools console to swallow the specific NotFoundError after logging.
//
// NOTE: Use cautiously—do NOT ship this patch to production builds.

if (import.meta.env.DEV && typeof window !== 'undefined') {
  (function initDomGuards(){
    if (window.__DOM_GUARDS_PATCHED__) return; // idempotent
    window.__DOM_GUARDS_PATCHED__ = true;

    // Circular buffer para eventos
    const MAX_EVENTS = 50;
    window.__REMOVE_CHILD_EVENTS = window.__REMOVE_CHILD_EVENTS || [];
    function pushEvent(evt){
      try {
        window.__REMOVE_CHILD_EVENTS.push(evt);
        if (window.__REMOVE_CHILD_EVENTS.length > MAX_EVENTS) {
          window.__REMOVE_CHILD_EVENTS.splice(0, window.__REMOVE_CHILD_EVENTS.length - MAX_EVENTS);
        }
      } catch { /* noop */ }
    }

    const originalRemoveChild = Element.prototype.removeChild;
    const originalAppendChild = Element.prototype.appendChild;
    const originalInsertBefore = Element.prototype.insertBefore;

    function describeNode(node) {
      if (!node || node.nodeType !== 1) {
        return node ? { nodeType: node.nodeType } : null;
      }
      return {
        tag: node.tagName,
        id: node.id || null,
        class: (node.className || '').toString().slice(0,120) || null,
        role: node.getAttribute?.('role') || null,
        ariaHidden: node.getAttribute?.('aria-hidden') || null,
        dataPortal: node.hasAttribute?.('data-radix-portal') || false,
        radixDialogContent: node.getAttribute?.('data-state') || null,
        // Avoid leaking full text (trim for signal only)
        textSample: (node.textContent || '').trim().slice(0,60) || null
      };
    }

    function siblingsOf(parent) {
      try {
        return Array.from(parent?.childNodes || [])
          .filter(n => n.nodeType === 1)
          .slice(0, 30)
          .map(describeNode);
      } catch { return []; }
    }

  let firstNotFoundLogged = false;
  let notFoundCountWindow = 0;
  let windowStart = Date.now();
  const WINDOW_MS = 2000;
  const AUTO_SUPPRESS_THRESHOLD = 25;
  // Throttling y dedupe simples para preMismatch
  let lastPreMismatchKey = '';
  let lastPreMismatchTime = 0;
  const PRE_MISMATCH_COOLDOWN = 300; // ms
  const PRE_MISMATCH_MAX_LOGS_PER_KEY = 8; // después de este número de logs individuales por key, se suprime detalle
  const PRE_MISMATCH_AGG_INTERVAL = 5000; // ms entre resúmenes agregados
  const preMismatchCounter = new Map();
  let lastAggPrint = 0;
  Element.prototype.removeChild = function patchedRemoveChild(child) {
    // Pre-check: if child is already detached or parent mismatch, log once and swallow.
    if (!child || child.parentNode !== this) {
      const now = Date.now();
      const preEvt = {
        type: 'removeChild.preMismatch',
        parent: describeNode(this),
        child: describeNode(child),
        hasChild: child ? Array.from(this.childNodes || []).includes(child) : false,
        time: now
      };
      pushEvent(preEvt);
      if (!window.__LABG40_SUPPRESS_REMOVECHILD_PREMISMATCH__) {
        // Generar una clave breve por tag/role para agrupar
        const key = `${preEvt.parent?.tag||'UNK'}>${preEvt.child?.tag||'UNK'}:${preEvt.child?.role||''}`;
        const count = (preMismatchCounter.get(key) || 0) + 1;
        preMismatchCounter.set(key, count);
        const shouldLogDetail = count <= PRE_MISMATCH_MAX_LOGS_PER_KEY;
        // Throttle logs de la misma relación (solo mientras aún no superamos el máximo de detalle)
        if (shouldLogDetail && (key !== lastPreMismatchKey || (now - lastPreMismatchTime) > PRE_MISMATCH_COOLDOWN)) {
          lastPreMismatchKey = key; lastPreMismatchTime = now;
          console.warn('[domGuard][removeChild.preMismatch]', { key, count, sample: preEvt });
        }
        // Logging agregado periódico una vez alcanzado el límite de detalle para cualquier key
        const anyOverLimit = count === PRE_MISMATCH_MAX_LOGS_PER_KEY + 1; // primer momento en que lo superamos
        const timeForAgg = now - lastAggPrint > PRE_MISMATCH_AGG_INTERVAL;
        if (anyOverLimit || timeForAgg) {
          lastAggPrint = now;
          const aggregate = {};
          preMismatchCounter.forEach((v,k)=>{ aggregate[k] = v; });
          console.info('[domGuard][removeChild.preMismatch][aggregate]', {
            keys: Object.keys(aggregate).length,
            top: Object.entries(aggregate).sort((a,b)=> b[1]-a[1]).slice(0,5),
            totalEvents: Array.from(preMismatchCounter.values()).reduce((a,b)=>a+b,0)
          });
          if (anyOverLimit) {
            console.info('[domGuard] (silenciando detalles repetidos por key>', PRE_MISMATCH_MAX_LOGS_PER_KEY, ') usar window.__dumpPreMismatch() para ver más');
          }
        }
      }
      // Early exit: no attempt to actually remove to evitar throw en cascada
      return child;
    }
    try {
      return originalRemoveChild.call(this, child);
    } catch (err) {
      const message = String(err?.message || '');
      const isTargetNotChild = /not a child/i.test(message) || (err?.name === 'NotFoundError');
      if (isTargetNotChild) {
        const now = Date.now();
        if (now - windowStart > WINDOW_MS) { windowStart = now; notFoundCountWindow = 0; }
        notFoundCountWindow++;
        const diag = {
          kind: 'NotFoundError.removeChild',
            time: now,
            parent: describeNode(this),
            child: describeNode(child),
            parentSiblingsSnapshot: siblingsOf(this),
            childsActualParent: describeNode(child?.parentNode),
            stack: (err.stack || '').split('\n').slice(0, 20).join('\n'),
            windowCount: notFoundCountWindow
        };
        pushEvent(diag);
        if (!firstNotFoundLogged) {
          console.error('[domGuard] Intercepted removeChild NotFoundError', diag);
          firstNotFoundLogged = true;
        } else if (!window.__LABG40_SUPPRESS_REMOVECHILD_ERROR__ && !window.__LABG40_SUPPRESS_REPEAT_REMOVECHILD__) {
          console.error('[domGuard] Intercepted removeChild NotFoundError (repeat)', { short: { parent: diag.parent, child: diag.child, time: diag.time, cnt: notFoundCountWindow } });
        }
        if (notFoundCountWindow >= AUTO_SUPPRESS_THRESHOLD && !window.__LABG40_SUPPRESS_REPEAT_REMOVECHILD__) {
          window.__LABG40_SUPPRESS_REPEAT_REMOVECHILD__ = true;
          console.warn('[domGuard] Auto-enabled __LABG40_SUPPRESS_REPEAT_REMOVECHILD__ after threshold');
        }
        if (window.__LABG40_SUPPRESS_REMOVECHILD_ERROR__ || window.__LABG40_SUPPRESS_REPEAT_REMOVECHILD__) {
          return child; // swallow
        }
      }
      throw err;
    }
  };

    // Patch appendChild para detectar reparenting silencioso
    Element.prototype.appendChild = function patchedAppendChild(child) {
      const reparent = child?.parentNode && child.parentNode !== this;
      if (reparent) {
        const evt = { type:'appendChild.reparent', time:Date.now(), newParent: describeNode(this), oldParent: describeNode(child.parentNode), child: describeNode(child) };
        pushEvent(evt);
        console.warn('[domGuard][appendChild.reparent]', evt);
      }
      return originalAppendChild.call(this, child);
    };

    // Patch insertBefore con detección adicional de before desacoplado
    const insertStats = { reparent:0, beforeDetached:0 };
    window.__DOM_GUARDS_INSERT_STATS__ = insertStats;
    Element.prototype.insertBefore = function patchedInsertBefore(child, before) {
      const reparent = child?.parentNode && child.parentNode !== this;
      const beforeDetached = before && before.parentNode !== this;
      if (reparent) {
        insertStats.reparent++;
        const evt = { type:'insertBefore.reparent', time:Date.now(), newParent: describeNode(this), oldParent: describeNode(child.parentNode), before: describeNode(before), child: describeNode(child), stats: { ...insertStats } };
        pushEvent(evt);
        console.warn('[domGuard][insertBefore.reparent]', evt);
      }
      if (beforeDetached) {
        insertStats.beforeDetached++;
        const evt = { type:'insertBefore.beforeDetached', time:Date.now(), parent: describeNode(this), before: describeNode(before), child: describeNode(child), siblings: siblingsOf(this), stats: { ...insertStats } };
        pushEvent(evt);
        // Fallback: si el nodo objetivo ya no es hijo, degradar a appendChild para evitar NotFoundError
        try {
          console.warn('[domGuard][insertBefore.beforeDetached] fallback -> appendChild');
          return originalAppendChild.call(this, child);
        } catch (err) {
          console.error('[domGuard][insertBefore.beforeDetached] append fallback failed', err);
          // Último recurso: devolver child sin lanzar
          return child;
        }
      }
      return originalInsertBefore.call(this, child, before);
    };

    // Exponer volcado simple de estadísticas
    window.__dumpDomGuardStats = () => {
      try {
        const evts = (window.__REMOVE_CHILD_EVENTS||[]).slice(-10);
        console.info('[domGuard][stats]', { insertStats: { ...insertStats }, lastEvents: evts });
      } catch (e) {
        console.warn('[domGuard][stats] error', e);
      }
    };

    window.__restoreDomGuards = () => {
      if (window.__DOM_GUARDS_PATCHED__) {
        Element.prototype.removeChild = originalRemoveChild;
        Element.prototype.appendChild = originalAppendChild;
        Element.prototype.insertBefore = originalInsertBefore;
        delete window.__DOM_GUARDS_PATCHED__;
        console.info('[domGuard] DOM guard patches restored to originals');
      }
    };

    // Exponer volcado agregado de preMismatch
    window.__dumpPreMismatch = () => {
      const aggregate = {};
      preMismatchCounter.forEach((v,k)=>{ aggregate[k] = v; });
      const entries = Object.entries(aggregate).sort((a,b)=> b[1]-a[1]);
      console.info('[domGuard][preMismatch.dump]', { totalKeys: entries.length, entries });
    };

    // Flags rápidas (para inspección en consola):
    // window.__LABG40_SUPPRESS_REMOVECHILD_PREMISMATCH__ = true  -> silencia cualquier preMismatch
    // window.__dumpPreMismatch()                                 -> muestra distribución completa

    console.info('[domGuard] removeChild/appendChild/insertBefore diagnostic patches installed');
  })();
}
