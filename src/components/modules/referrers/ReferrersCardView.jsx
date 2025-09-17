import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, Edit, Trash2, FileText, Phone, Mail, Stethoscope } from 'lucide-react';
import PriceListTrigger from './PriceListTrigger';

const ReferrersCardView = ({
  referrers,
  handleEdit,
  openDeleteConfirm,
  openPriceListPDFModal,
  studies,
  packagesData,
  onUpdateReferrerPrices,
  particularReferrer,
  isSubmitting
}) => {
  if (!referrers || referrers.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">No se encontraron referentes.</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 p-4">
      {referrers.map(referrer => (
        <Card key={referrer.id} className="bg-card/80 dark:bg-card/70">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <CardTitle className="text-lg font-bold text-sky-800 dark:text-sky-300">{referrer.name}</CardTitle>
                <CardDescription>{referrer.entity_type}</CardDescription>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" disabled={isSubmitting}>
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {referrer.name !== 'Particular' && (
                    <DropdownMenuItem onClick={() => handleEdit(referrer)} disabled={isSubmitting}>
                      <Edit className="mr-2 h-4 w-4 text-blue-500" /> Editar
                    </DropdownMenuItem>
                  )}
                  <PriceListTrigger
                    referrer={referrer}
                    studies={studies}
                    packagesData={packagesData}
                    onUpdateReferrerPrices={onUpdateReferrerPrices}
                    particularReferrer={particularReferrer}
                    isSubmitting={isSubmitting}
                  />
                  <DropdownMenuItem onClick={() => openPriceListPDFModal(referrer)} disabled={isSubmitting}>
                    <FileText className="mr-2 h-4 w-4 text-indigo-500" /> Ver Lista (PDF)
                  </DropdownMenuItem>
                  {referrer.name !== 'Particular' && (
                    <DropdownMenuItem onClick={() => openDeleteConfirm(referrer)} className="text-red-600 dark:text-red-400" disabled={isSubmitting}>
                      <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {referrer.specialty && (
              <div className="flex items-center">
                <Stethoscope className="h-4 w-4 mr-2 text-muted-foreground" />
                <span>{referrer.specialty}</span>
              </div>
            )}
            {referrer.email && (
              <div className="flex items-center">
                <Mail className="h-4 w-4 mr-2 text-muted-foreground" />
                <span>{referrer.email}</span>
              </div>
            )}
            {referrer.phone_number && (
              <div className="flex items-center">
                <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
                <span>{referrer.phone_number}</span>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default ReferrersCardView;