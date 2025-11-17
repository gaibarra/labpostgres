import { useEffect, useState } from 'react';
import { loadRecharts } from '@/lib/dynamicImports';

export const useLazyRecharts = () => {
  const [recharts, setRecharts] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    loadRecharts()
      .then((module) => {
        if (!isMounted) return;
        setRecharts(module);
        setIsLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('No se pudo cargar Recharts dinámicamente.', err);
        setError(err);
        setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  return { recharts, isLoading, error };
};
