import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';

const SuccessPatientDialog = ({ isOpen, onOpenChange, title, description }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby="dialog-description">
        <DialogHeader>
          <div className="flex justify-center">
            <CheckCircle className="h-16 w-16 text-green-500" />
          </div>
          <DialogTitle className="text-center text-2xl mt-4">{title}</DialogTitle>
        </DialogHeader>
        <DialogDescription id="dialog-description" className="text-center text-muted-foreground">{description}</DialogDescription>
        <DialogFooter className="sm:justify-center pt-4">
          <Button onClick={() => onOpenChange(false)}>Entendido</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SuccessPatientDialog;