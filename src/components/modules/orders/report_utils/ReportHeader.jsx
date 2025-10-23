import React from 'react';
import { format } from 'date-fns-tz';
import { es } from 'date-fns/locale';

const ReportHeader = ({ labInfo, order, patient, patientAgeData, isWorksheet = false, compact = false }) => {
  if (!order || !patient) return null;

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'dd/MMMM/yyyy', { locale: es, timeZone: 'UTC' });
    } catch (error) {
      return 'Fecha inválida';
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'HH:mm', { timeZone: 'UTC' });
    } catch (error) {
      return 'Hora inválida';
    }
  };
  
  const displayAge = () => {
    if (!patientAgeData) return 'N/A';
    const { ageYears, fullMonths, fullDays, unit } = patientAgeData;
    if (ageYears > 0) return `${ageYears} ${unit}`;
    if (fullMonths > 0) return `${fullMonths} mes(es)`;
    return `${fullDays} día(s)`;
  }

  // Helper para formatear dirección: acepta string u objeto
  const formatAddress = (addr) => {
    if (!addr) return 'Dirección del Laboratorio';
    if (typeof addr === 'string') return addr;
    if (typeof addr === 'object') {
      // Soportar claves en español e inglés
      const street = addr.calle || addr.street || '';
      const extNo = addr.numeroExterior || addr.exterior || addr.number || '';
      const intNo = addr.numeroInterior || addr.interior || addr.int || '';
      const neighborhood = addr.colonia || addr.neighborhood || '';
      const postal = addr.codigoPostal || addr.postal || addr.postal_code || '';
      const city = addr.ciudad || addr.city || '';
      const state = addr.estado || addr.state || '';
      const country = addr.pais || addr.country || '';
      const parts = [
        [street, extNo].filter(Boolean).join(' '),
        intNo ? `Int. ${intNo}` : '',
        neighborhood,
        postal ? `CP ${postal}` : '',
        city,
        state,
        country,
      ].filter(Boolean);
      return parts.join(', ');
    }
    try { return String(addr); } catch { return 'Dirección del Laboratorio'; }
  };

  const FullHeader = () => (
    <div className={"flex items-center " + (compact ? "mb-1" : "mb-2") }>
      {/* Left: Logo (fixed width) */}
      <div className={compact ? "w-28 flex-shrink-0" : "w-32 flex-shrink-0"}>
        {labInfo?.logoUrl ? (
          <img-replace src={labInfo.logoUrl} alt="Logo del Laboratorio" className={compact ? "max-h-12" : "max-h-16"} />
        ) : (
          <div className={compact ? "h-12 w-28" : "h-16 w-32" + " bg-slate-200 flex items-center justify-center"}>
            <span className="text-slate-500">Logo</span>
          </div>
        )}
      </div>
      {/* Center: Name + Contact fully centered */}
      <div className="flex-1 text-center">
        <h2 className={compact ? "font-bold text-base" : "font-bold text-lg"}>{labInfo?.name || 'Nombre del Laboratorio'}</h2>
        <p className={compact ? "text-[10px]" : undefined}>{formatAddress(labInfo?.address ?? {
          calle: labInfo?.calle,
          numeroExterior: labInfo?.numeroExterior,
          numeroInterior: labInfo?.numeroInterior,
          colonia: labInfo?.colonia,
          codigoPostal: labInfo?.codigoPostal,
          ciudad: labInfo?.ciudad,
          estado: labInfo?.estado,
          pais: labInfo?.pais,
        })}</p>
        <p className={compact ? "text-[10px]" : undefined}>Tel: {labInfo?.phone || 'Teléfono'} | Email: {labInfo?.email || 'Email'}</p>
      </div>
      {/* Right: spacer to keep center alignment when logo occupies left */}
      <div className="w-32 flex-shrink-0" />
    </div>
  );

  const WorksheetHeader = () => (
    <div className={"text-center " + (compact ? "mb-1" : "mb-2") }>
      <h2 className={compact ? "font-bold text-lg" : "font-bold text-xl"}>Hoja de Trabajo</h2>
    </div>
  );

  return (
    <div className="text-xs text-slate-800 dark:text-slate-200">
      {isWorksheet ? <WorksheetHeader /> : <FullHeader />}

      <div className={"border-t border-b border-slate-400 dark:border-slate-600 grid grid-cols-2 " + (compact ? "py-0.5" : "py-1") }>
        <div className="pr-2">
          <div className="flex">
            <span className="font-bold w-24">PACIENTE:</span>
            <span>{patient.full_name}</span>
          </div>
          <div className="flex">
            <span className="font-bold w-24">EDAD:</span>
            <span>{displayAge()}</span>
          </div>
          <div className="flex">
            <span className="font-bold w-24">SEXO:</span>
            <span>{patient.sex}</span>
          </div>
          <div className="flex">
            <span className="font-bold w-24">MÉDICO:</span>
            <span>{order.referring_entity_name || 'N/A'}</span>
          </div>
        </div>
        <div className={"pl-2 border-l border-slate-400 dark:border-slate-600 " + (compact ? "text-[11px]" : "") }>
          <div className="flex">
            <span className="font-bold w-32">FECHA DE TOMA:</span>
            <span>{formatDate(order.order_date)}</span>
          </div>
          <div className="flex">
            <span className="font-bold w-32">HORA DE TOMA:</span>
            <span>{formatTime(order.order_date)}</span>
          </div>
          <div className="flex">
            <span className="font-bold w-32">FECHA DE REPORTE:</span>
            <span>{formatDate(new Date())}</span>
          </div>
          <div className="flex">
            <span className="font-bold w-32">FOLIO:</span>
            <span>{order.folio}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportHeader;