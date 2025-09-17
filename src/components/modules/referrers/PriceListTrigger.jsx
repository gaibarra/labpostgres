import React, { useState } from 'react';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import PriceListModal from './PriceListModal';
import { DollarSign } from 'lucide-react';

const PriceListTrigger = ({ referrer, studies, packagesData, onUpdateReferrerPrices, particularReferrer, isSubmitting }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem 
          onSelect={(e) => e.preventDefault()} 
          className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
          disabled={isSubmitting}
        >
          <DollarSign className="mr-2 h-4 w-4 text-green-500" />
          Gestionar Precios
        </DropdownMenuItem>
      </DialogTrigger>
      <PriceListModal
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        referrer={referrer}
        studies={studies}
        packagesData={packagesData}
        onUpdateReferrerPrices={onUpdateReferrerPrices}
        particularReferrer={particularReferrer}
        isParentSubmitting={isSubmitting}
      />
    </Dialog>
  );
};

export default PriceListTrigger;