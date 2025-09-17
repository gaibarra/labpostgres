import { format as formatFns, parseISO } from 'date-fns';
import { utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz';
import { es } from 'date-fns/locale';

const TIME_ZONE = 'America/Hermosillo';

export const toTimeZone = (date, timeZone = TIME_ZONE) => {
  if (!date) return null;
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return utcToZonedTime(dateObj, timeZone);
};

export const fromTimeZone = (date, timeZone = TIME_ZONE) => {
  if (!date) return null;
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return zonedTimeToUtc(dateObj, timeZone);
};

export const formatInTimeZone = (date, formatString, timeZone = TIME_ZONE) => {
  if (!date) return '';
  const zonedDate = toTimeZone(date, timeZone);
  return formatFns(zonedDate, formatString, { locale: es, timeZone });
};

export const toISOStringWithTimeZone = (date, timeZone = TIME_ZONE) => {
  if (!date) return null;
  const utcDate = zonedTimeToUtc(date, timeZone);
  return utcDate.toISOString();
};