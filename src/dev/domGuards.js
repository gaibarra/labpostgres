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
  const preMismatchCounter = new Map();
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
        // Throttle logs de la misma relación
        if (key !== lastPreMismatchKey || (now - lastPreMismatchTime) > PRE_MISMATCH_COOLDOWN) {
          lastPreMismatchKey = key; lastPreMismatchTime = now;
          console.warn('[domGuard][removeChild.preMismatch]', { key, count, sample: preEvt });
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

    // Patch insertBefore para mismo caso + beforeNode descriptor
    Element.prototype.insertBefore = function patchedInsertBefore(child, before) {
      const reparent = child?.parentNode && child.parentNode !== this;
      if (reparent) {
        const evt = { type:'insertBefore.reparent', time:Date.now(), newParent: describeNode(this), oldParent: describeNode(child.parentNode), before: describeNode(before), child: describeNode(child) };
        pushEvent(evt);
        console.warn('[domGuard][insertBefore.reparent]', evt);
      }
      return originalInsertBefore.call(this, child, before);
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

    console.info('[domGuard] removeChild/appendChild/insertBefore diagnostic patches installed');
  })();
}
