import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, Edit, Trash2, Package, DollarSign, Info } from 'lucide-react';

const PackagesCardView = ({
  packages,
  getParticularPrice,
  getItemNameByIdAndType,
  handleEdit,
  openDeleteConfirm,
  isSubmitting
}) => {
  if (!packages || packages.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">No se encontraron paquetes.</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 p-4">
      {packages.map(pkg => (
        <Card key={pkg.id} className="bg-card/80 dark:bg-card/70">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <CardTitle className="text-lg font-bold text-sky-800 dark:text-sky-300 flex items-center">
                  <Package className="h-5 w-5 mr-2" />
                  {pkg.name}
                </CardTitle>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" disabled={isSubmitting}>
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleEdit(pkg)} disabled={isSubmitting}>
                    <Edit className="mr-2 h-4 w-4 text-blue-500" /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openDeleteConfirm(pkg)} className="text-red-600 dark:text-red-400" disabled={isSubmitting}>
                    <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center">
              <DollarSign className="h-4 w-4 mr-2 text-muted-foreground" />
              <span className="font-semibold">{getParticularPrice(pkg.id)} MXN</span>
            </div>
            <div className="flex items-start">
              <Info className="h-4 w-4 mr-2 mt-0.5 text-muted-foreground" />
              <div>
                <span className="font-semibold">Items ({(pkg.items || []).length}): </span>
                <span>{(pkg.items || []).slice(0, 3).map(item => getItemNameByIdAndType(item.item_id, item.item_type)).join(', ')}
                {(pkg.items || []).length > 3 ? '...' : ''}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default PackagesCardView;