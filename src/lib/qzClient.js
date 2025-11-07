// Lightweight QZ Tray client wrapper
// Requires qz-tray.js to be loaded in index.html or dynamically

let qzLoaded = false;

export async function ensureQZ() {
  if (window.qz) return window.qz;
  if (qzLoaded) return window.qz;
  // try dynamic import from CDN
  return new Promise((resolve, reject) => {
    try {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qz-tray/2.2.3/qz-tray.min.js';
      script.async = true;
      script.onload = () => {
        qzLoaded = true;
        resolve(window.qz);
      };
      script.onerror = () => reject(new Error('No se pudo cargar QZ Tray'));
      document.head.appendChild(script);
    } catch (e) {
      reject(e);
    }
  });
}

export async function listPrinters() {
  const qz = await ensureQZ();
  if (!qz?.printers) return [];
  try {
    return await qz.printers.find();
  } catch (_) {
    return [];
  }
}

export async function printHtmlTo(printerName, html, options = {}) {
  const qz = await ensureQZ();
  const cfg = qz.configs.create(printerName, {
    copies: options.copies || 1,
    size: options.size || null, // e.g., { width: '50mm', height: '25mm' }
    margins: 0,
    colorType: 'grayscale',
    rasterize: true,
  });
  const printData = [{ type: 'html', format: 'plain', data: html }];
  return qz.print(cfg, printData);
}
