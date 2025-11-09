import React, { useState, useEffect, useCallback } from 'react';
import { getPackageItems, reorderPackageItems, addPackageItem, reorderList } from '../../lib/packagesApi';
import { apiClient } from '../../lib/apiClient';
import { toast } from 'sonner';

// Minimal drag & drop using native HTML drag events.
// Assumes parent provides packageId.
export function PackageItemsReorder({ packageId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await getPackageItems(packageId);
      // Items come ordered by backend (position); ensure we expose position
      const enriched = data.map((it, idx) => ({ ...it, _localIndex: idx }));
      setItems(enriched);
    } catch (e) { setError(e.message || 'Error cargando items'); }
    finally { setLoading(false); }
  }, [packageId]);

  useEffect(() => { load(); }, [load]);

  function onDragStart(e, index) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  }
  function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }
  function onDrop(e, index) {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (isNaN(fromIndex)) return;
    if (fromIndex === index) return;
    setItems(prev => reorderList(prev, fromIndex, index));
  }

  async function persistOrder() {
    setSaving(true); setError(null);
    try {
      const orderedIds = items.map(i => i.id);
      await reorderPackageItems(packageId, orderedIds);
      await load();
      toast.success('Orden del paquete guardado');
    } catch (e) { setError(e.message || 'Error guardando orden'); }
    finally { setSaving(false); }
  }

  async function addDummyItem() {
    // Example: Add a dummy analysis item (replace with actual selection UI)
    setSaving(true); setError(null);
    try {
      // Fetch some analysis to use as demonstration if needed
      const analyses = await apiClient.get('/analysis?limit=1&offset=0');
      const firstAnalysis = analyses?.data?.[0];
      if (!firstAnalysis) {
        setError('No hay análisis para crear item de ejemplo');
      } else {
        await addPackageItem(packageId, { itemId: firstAnalysis.id });
        await load();
      }
    } catch (e) {
      const msg = e?.message || (e?.status === 409 ? 'Conflicto al agregar el ítem' : 'Error agregando item');
      // Mostrar toast para mejor UX
      toast.error(msg, { duration: 3500 });
      setError(msg);
    }
    finally { setSaving(false); }
  }

  if (loading) return <div>Cargando items...</div>;
  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">Orden de Ítems del Paquete</h3>
  <p className="text-sm text-muted-foreground">Arrastra filas para cambiar el orden. Luego pulsa &quot;Guardar orden&quot;.</p>
      <div className="border rounded">
        <ul className="divide-y">
          {items.map((it, idx) => (
            <li key={it.id}
                draggable
                onDragStart={(e) => onDragStart(e, idx)}
                onDragOver={onDragOver}
                onDrop={(e) => onDrop(e, idx)}
                className="p-2 flex items-center gap-3 bg-white hover:bg-gray-50 cursor-move">
              <span className="text-xs font-mono w-8 text-gray-500">{idx+1}</span>
              <span className="flex-1">{it.name || 'Item desconocido'} <span className="text-xs text-gray-400">({it.item_type})</span></span>
              <span className="text-xs text-gray-400">id:{it.id.slice(0,8)}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex gap-2">
        <button disabled={saving} onClick={persistOrder} className="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-50">{saving ? 'Guardando...' : 'Guardar orden'}</button>
        <button disabled={saving} onClick={addDummyItem} className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50">Añadir ítem ejemplo</button>
        <button disabled={saving} onClick={load} className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50">Recargar</button>
      </div>
    </div>
  );
}

export default PackageItemsReorder;
