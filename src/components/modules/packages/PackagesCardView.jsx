import React, { useState } from 'react';
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
  // Manage expand/collapse per card
  const [expanded, setExpanded] = useState({});
  const toggle = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

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
              <div className="flex-1">
                {(() => {
                  const items = Array.isArray(pkg.items) ? pkg.items : [];
                  const isExpanded = !!expanded[pkg.id];
                  const COMPACT = 8;
                  const visible = isExpanded ? items : items.slice(0, COMPACT);
                  const isStudyType = (t) => t === 'study' || t === 'analysis';
                  const studies = visible.filter(i => isStudyType(i.item_type));
                  const packs = visible.filter(i => i.item_type === 'package');
                  const hidden = !isExpanded && items.length > COMPACT ? items.length - COMPACT : 0;
                  return (
                    <div>
                      <div className="font-semibold mb-1">Items ({items.length}):</div>
                      {studies.length > 0 && (
                        <div className="mb-1">
                          <div className="uppercase tracking-wide text-[10px] text-slate-500 dark:text-slate-400 mb-1">Estudios</div>
                          <div className="flex flex-wrap gap-1.5">
                            {studies.map((item, idx) => (
                              <button
                                key={`cv-${pkg.id}-study-${idx}`}
                                type="button"
                                onClick={() => handleEdit(pkg)}
                                className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600 bg-sky-50 dark:bg-slate-800/60 text-[11px] text-slate-700 dark:text-slate-300 hover:bg-sky-100 hover:underline"
                              >
                                {getItemNameByIdAndType(item.item_id, item.item_type)}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {packs.length > 0 && (
                        <div>
                          <div className="uppercase tracking-wide text-[10px] text-slate-500 dark:text-slate-400 mb-1">Paquetes</div>
                          <div className="flex flex-wrap gap-1.5">
                            {packs.map((item, idx) => (
                              <button
                                key={`cv-${pkg.id}-package-${idx}`}
                                type="button"
                                onClick={() => handleEdit(pkg)}
                                className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600 bg-emerald-50 dark:bg-slate-800/60 text-[11px] text-slate-700 dark:text-slate-300 hover:bg-emerald-100 hover:underline"
                              >
                                {getItemNameByIdAndType(item.item_id, item.item_type)}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="mt-2">
                        <button
                          type="button"
                          className="text-[11px] text-sky-600 hover:text-sky-700 dark:text-sky-400 hover:underline"
                          onClick={() => toggle(pkg.id)}
                        >
                          {isExpanded ? 'Compactar' : (hidden > 0 ? `Expandir (${hidden} más)` : 'Compacto')}
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default PackagesCardView;