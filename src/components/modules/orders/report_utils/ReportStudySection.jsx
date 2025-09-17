import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FlaskConical, ArrowUp, ArrowDown, Check, AlertTriangle, Minus, Clock } from 'lucide-react';
import { cn } from "@/lib/utils";

const ReportStudySection = ({ studyDetail, orderResults, patient, getReferenceRangeText, evaluateResult, patientAgeData }) => {
  
  const getResultDisplay = (resultValue, paramDetail) => {
    if (resultValue === "PENDIENTE" || resultValue === undefined || resultValue === null || String(resultValue).trim() === '') {
      return (
        <span className={cn("flex items-center justify-center text-xs text-slate-400 dark:text-slate-500 italic font-normal")}>
          <Clock className="h-3 w-3 text-slate-400 inline mr-1.5" />
          PENDIENTE
        </span>
      );
    }

    const paramDefinition = studyDetail.parameters.find(pDef => pDef.id === paramDetail.parametroId);
    
    const paramForEval = {
      ...paramDetail,
      ...paramDefinition, 
      reference_ranges: paramDefinition?.reference_ranges || paramDetail.reference_ranges || []
    };

    const status = evaluateResult(String(resultValue), paramForEval, patient, patientAgeData);
    let icon;
    let textColor = "text-slate-800 dark:text-slate-100";
    let textStyle = "font-semibold";
    let bgColor = "bg-transparent";

    switch (status) {
      case 'bajo':
        icon = <ArrowDown className="h-3.5 w-3.5 text-white" />;
        textColor = "text-white";
        bgColor = "bg-blue-500";
        break;
      case 'alto':
        icon = <ArrowUp className="h-3.5 w-3.5 text-white" />;
        textColor = "text-white";
        bgColor = "bg-orange-500";
        break;
      case 'valido-alfanumerico':
      case 'normal':
        icon = <Check className="h-3.5 w-3.5 text-white" />;
        textColor = "text-white";
        bgColor = "bg-green-500";
        break;
      case 'invalido-alfanumerico':
        icon = <AlertTriangle className="h-3.5 w-3.5 text-white" />;
        textColor = "text-white";
        bgColor = "bg-yellow-500";
        break;
      case 'no-evaluable':
      case 'no-numerico':
      default:
        icon = <Minus className="h-3.5 w-3.5 text-slate-500" />;
        textColor = "text-slate-500 dark:text-slate-400";
        textStyle = "font-normal";
    }
    
    return (
      <div className="flex items-center justify-center">
        <div className={cn("flex items-center justify-center gap-x-1.5 rounded-full px-2.5 py-0.5", bgColor)}>
          {icon}
          <span className={cn("text-xs", textColor, textStyle)}>{String(resultValue)}</span>
        </div>
      </div>
    );
  };

  const getReferenceRangeDisplay = (param, patient, patientAgeData) => {
    const paramDefinition = studyDetail.parameters.find(pDef => pDef.id === param.id);
    if (!paramDefinition) return <span className="text-slate-500 dark:text-slate-400">N/A</span>;
    
    const paramForText = { ...paramDefinition };
    const refData = getReferenceRangeText(paramForText, patient, patientAgeData, true);
    
    if (!refData || refData.valueText === 'N/A') {
      return <span className="text-slate-500 dark:text-slate-400">N/A</span>;
    }
    return (
      <div className="flex flex-col">
        <span className="font-medium text-slate-700 dark:text-slate-200">{refData.valueText}</span>
        <span className="text-[10px] text-slate-400 dark:text-slate-500">{refData.demographics}</span>
      </div>
    );
  };

  return (
    <Card className="bg-white dark:bg-slate-800/50 shadow-md border dark:border-slate-700/40 overflow-hidden">
      <CardHeader className="bg-slate-100 dark:bg-slate-800 py-2 px-4 rounded-t-lg border-b dark:border-slate-700">
        <CardTitle className="text-base font-semibold text-sky-800 dark:text-sky-300 flex items-center">
          <FlaskConical className="h-4 w-4 mr-2"/> {studyDetail.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table className="text-xs">
          <TableHeader>
            <TableRow className="bg-slate-50/50 dark:bg-slate-700/30 hover:bg-slate-100/70 dark:hover:bg-slate-700/40">
              <TableHead className="w-[30%] pl-4 py-2 text-slate-600 dark:text-slate-300 font-semibold">Parámetro</TableHead>
              <TableHead className="w-[20%] py-2 text-center text-slate-600 dark:text-slate-300 font-semibold">Resultado</TableHead>
              <TableHead className="w-[15%] py-2 text-center text-slate-600 dark:text-slate-300 font-semibold">Unidades</TableHead>
              <TableHead className="w-[35%] pr-4 py-2 text-slate-600 dark:text-slate-300 font-semibold">Valores de Referencia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(studyDetail.parameters || []).map(param => {
              const resultEntry = orderResults.find(r => r.parametroId === param.id);
              const rawValue = resultEntry ? resultEntry.valor : undefined;
              let resultValueToDisplay;
              if (rawValue === undefined || rawValue === null || String(rawValue).trim() === '') {
                resultValueToDisplay = "PENDIENTE";
              } else {
                resultValueToDisplay = rawValue;
              }
              
              const resultForDisplay = {
                parametroId: param.id,
                valor: resultValueToDisplay
              };
              
              return (
                <TableRow key={param.id || param.name} className="even:bg-slate-50/40 dark:even:bg-slate-800/20 hover:bg-sky-50/30 dark:hover:bg-sky-800/10 border-b dark:border-slate-200/50 dark:border-slate-700/50 last:border-b-0">
                  <TableCell className="pl-4 py-2.5 font-medium text-slate-700 dark:text-slate-200">{param.name}</TableCell>
                  <TableCell className="py-2.5 text-center">
                    {getResultDisplay(resultForDisplay.valor, resultForDisplay)}
                  </TableCell>
                  <TableCell className="py-2.5 text-center text-slate-500 dark:text-slate-400">{param.unit || studyDetail.general_units || ''}</TableCell>
                  <TableCell className="pr-4 py-2.5 text-slate-500 dark:text-slate-400 leading-snug">
                    {getReferenceRangeDisplay(param, patient, patientAgeData)}
                  </TableCell>
                </TableRow>
              );
            })}
             {(!studyDetail.parameters || studyDetail.parameters.length === 0) && (
                <TableRow>
                    <TableCell colSpan={4} className="text-center text-slate-400 dark:text-slate-500 py-3 text-xs">
                        Este estudio no tiene parámetros definidos.
                    </TableCell>
                </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default ReportStudySection;