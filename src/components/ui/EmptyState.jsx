import React from 'react';

/**
 * Un componente genérico para mostrar cuando una lista o búsqueda está vacía.
 * @param {{ icon: React.ElementType, title: string, description: string }} props
 * @param {React.ElementType} props.icon - El componente de ícono a mostrar (ej. de lucide-react).
 * @param {string} props.title - El mensaje principal.
 * @param {string} props.description - Un texto secundario o sugerencia.
 */
const EmptyState = ({ icon: Icon, title, description }) => {
  return (
    <div className="text-center py-10 px-4 bg-slate-50/50 dark:bg-slate-800/20 rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700">
      {Icon && <Icon className="mx-auto h-12 w-12 text-slate-400 dark:text-slate-500 mb-3" />}
      <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">{title}</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{description}</p>
    </div>
  );
};

export default EmptyState;
