// Local workstation printing preferences for labels
// Stored in localStorage per browser

const LS_KEY = 'labg40.labelPrinting.prefs.v1';

export const LABEL_SIZE_PRESETS = [
  { id: 'tube_25x25', label: 'Tubo 25×25 mm', widthMm: 25, heightMm: 25, orientation: 'portrait' },
  { id: 'tube_38x19', label: 'Tubo 38×19 mm', widthMm: 38, heightMm: 19, orientation: 'landscape' },
  { id: 'vial_50x25', label: 'Vial/Recipiente 50×25 mm', widthMm: 50, heightMm: 25, orientation: 'landscape' },
  { id: 'container_70x25', label: 'Recipiente 70×25 mm', widthMm: 70, heightMm: 25, orientation: 'landscape' },
  { id: 'doc_A4', label: 'Documento A4', widthMm: 210, heightMm: 297, orientation: 'portrait' },
  { id: 'doc_Letter', label: 'Documento Carta (8.5×11 in)', widthIn: 8.5, heightIn: 11, orientation: 'portrait' },
  { id: 'custom', label: 'Personalizado…', widthMm: 50, heightMm: 25, orientation: 'landscape' },
];

export function loadLabelPrefs() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (_) {
    return {};
  }
}

export function saveLabelPrefs(prefs) {
  try {
    const current = loadLabelPrefs();
    localStorage.setItem(LS_KEY, JSON.stringify({ ...current, ...prefs }));
  } catch (_) {
    // ignore
  }
}

export function getPresetById(id) {
  return LABEL_SIZE_PRESETS.find(p => p.id === id);
}

export function getActiveSize(prefs) {
  const preset = getPresetById(prefs?.sizeId) || LABEL_SIZE_PRESETS[2]; // default 50×25
  if (preset.id === 'custom') {
    return {
      widthMm: Number(prefs?.customWidthMm) || 50,
      heightMm: Number(prefs?.customHeightMm) || 25,
      orientation: prefs?.orientation || 'landscape',
    };
  }
  if (preset.widthIn && preset.heightIn) {
    return { widthIn: preset.widthIn, heightIn: preset.heightIn, orientation: preset.orientation };
  }
  return { widthMm: preset.widthMm, heightMm: preset.heightMm, orientation: preset.orientation };
}

export function pageSizeCss(prefs) {
  const size = getActiveSize(prefs);
  if (size.widthIn && size.heightIn) {
    return `@page { size: ${size.widthIn}in ${size.heightIn}in; margin: 0; }`;
  }
  return `@page { size: ${size.widthMm}mm ${size.heightMm}mm; margin: 0; }`;
}
