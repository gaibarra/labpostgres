// Utilidad para formatear un conjunto de rangos de referencia en una representación compacta
// Casos:
//  - Ambos límites: "1–3"
//  - Solo lower: ">=1"
//  - Solo upper: "<=3"
//  - Texto: usa text_value / textoLibre / textoPermitido
//  - Notas: se añaden entre paréntesis al final si existen
//  - Si no hay nada numérico ni texto, retorna null (para que el caller oculte en vez de mostrar N/A)
export function formatSingleRange(vr){
  if (!vr) return null;
  const lower = vr.valorMin ?? vr.lower ?? null;
  const upper = vr.valorMax ?? vr.upper ?? null;
  const texto = vr.textoLibre || vr.textoPermitido || vr.text_value || null;
  let core = null;
  if (lower != null && upper != null) core = `${lower}–${upper}`;
  else if (lower != null) core = `>=${lower}`;
  else if (upper != null) core = `<=${upper}`;
  else if (texto) core = texto.length > 80 ? texto.slice(0,77)+'…' : texto;
  if (!core) return null;
  const notas = vr.notas || vr.notes || null;
  return notas ? `${core} (${notas})` : core;
}

export function formatReferenceRangeList(list){
  if (!Array.isArray(list) || !list.length) return [];
  return list
    .map(formatSingleRange)
    .filter(Boolean);
}
