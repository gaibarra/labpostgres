let jsPdfPromise;
export const loadJsPdf = () => {
  if (!jsPdfPromise) {
    jsPdfPromise = Promise.all([
      import('jspdf'),
      import('jspdf-autotable')
    ])
      .then(([jsPdfModule, autoTableModule]) => {
        const jsPDFExport = jsPdfModule?.default || jsPdfModule?.jsPDF || jsPdfModule;
        const autoTableExport = autoTableModule?.default || autoTableModule;
        if (typeof jsPDFExport !== 'function') {
          throw new Error('jsPDF no se pudo cargar correctamente.');
        }
        if (typeof autoTableExport !== 'function') {
          throw new Error('jspdf-autotable no se pudo cargar correctamente.');
        }
        return { jsPDF: jsPDFExport, autoTable: autoTableExport };
      })
      .catch((error) => {
        jsPdfPromise = null;
        throw error;
      });
  }
  return jsPdfPromise;
};

let rechartsPromise;
export const loadRecharts = () => {
  if (!rechartsPromise) {
    rechartsPromise = import('recharts')
      .then((module) => module)
      .catch((error) => {
        rechartsPromise = null;
        throw error;
      });
  }
  return rechartsPromise;
};
