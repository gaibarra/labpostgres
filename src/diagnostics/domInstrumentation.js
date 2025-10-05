// Instrumentación para detectar llamadas problemáticas a removeChild / remove
// Sólo se activa en desarrollo y no en producción para minimizar overhead.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  try {
    const origRemoveChild = Node.prototype.removeChild;
    Node.prototype.removeChild = function(child) {
      if (child && child.parentNode !== this) {
        // Log detallado con stack para ubicar origen
        // Usamos console.groupCollapsed para no saturar
        console.groupCollapsed('[DOM-INSTRUMENT][removeChild mismatch]');
        console.warn('Parent attempting removeChild of node not its child');
        console.log('Parent:', this);
        console.log('Child:', child);
        console.trace('Stack');
        console.groupEnd();
        // Evitamos lanzar excepción para que la app siga y podamos recolectar logs
        return child;
      }
      return origRemoveChild.call(this, child);
    };

    const origRemove = Element.prototype.remove;
    Element.prototype.remove = function() {
      if (this.parentNode && this.parentNode.nodeType === 1) {
        // parentNode.removeChild nos dará el mismo hook
        return origRemove.call(this);
      }
      // Si no tiene parent, sólo traceamos
      console.groupCollapsed('[DOM-INSTRUMENT][remove orphan]');
      console.log('Element already detached', this);
      console.trace('Stack');
      console.groupEnd();
    };
  } catch (e) {
    console.warn('[DOM-INSTRUMENT] Failed to patch DOM methods', e);
  }
}