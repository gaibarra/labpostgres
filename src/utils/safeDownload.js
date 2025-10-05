// Utilidad para descargas seguras evitando errores NotFoundError en removeChild
// Crea un link temporal, dispara click y asegura remover el nodo sólo si sigue presente.
export function triggerDownload(href, filename, attrs={}) {
  if (!href) return;
  const link = document.createElement('a');
  link.style.display = 'none';
  link.href = href;
  if (filename) link.download = filename;
  Object.entries(attrs).forEach(([k,v])=>{ if(v!=null) link.setAttribute(k,v); });
  document.body.appendChild(link);
  try { link.click(); }
  finally {
    if (link.parentNode === document.body) {
      document.body.removeChild(link);
    }
  }
}

// Variante para Blob
export function triggerBlobDownload(blob, filename){
  if(!blob) return;
  const url = URL.createObjectURL(blob);
  try { triggerDownload(url, filename); }
  finally { setTimeout(()=>URL.revokeObjectURL(url), 1000); }
}