import { toast } from "@/components/ui/use-toast";

export const ensurePriceListStructureForReferrer = (referrer) => {
  const defaultPriceListStructure = { studies: [], packages: [] };
  const newReferrer = { ...referrer };

  if (!newReferrer.listaprecios || typeof newReferrer.listaprecios !== 'object' || Array.isArray(newReferrer.listaprecios)) {
    newReferrer.listaprecios = { 
      studies: [...defaultPriceListStructure.studies], 
      packages: [...defaultPriceListStructure.packages] 
    };
  } else {
    newReferrer.listaprecios.studies = (Array.isArray(newReferrer.listaprecios.studies) 
      ? newReferrer.listaprecios.studies.map(s => ({
          ...s, 
          price: parseFloat(s.price) || 0,
          itemId: s.itemId || '',
          itemType: s.itemType || 'study'
        })) 
      : []).filter(s => s.itemId);
    newReferrer.listaprecios.packages = (Array.isArray(newReferrer.listaprecios.packages) 
      ? newReferrer.listaprecios.packages.map(p => ({
          ...p, 
          price: parseFloat(p.price) || 0,
          itemId: p.itemId || '',
          itemType: p.itemType || 'package'
        }))
      : []).filter(p => p.itemId);
  }
  return newReferrer;
};