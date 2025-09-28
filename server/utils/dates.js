// Utilidades de fechas civiles (sin componente horario)
// Mantener aquí cualquier lógica compartida para normalizar fechas tipo YYYY-MM-DD

/**
 * Normaliza una fecha civil representada como string o Date a formato 'YYYY-MM-DD'.
 * - Si recibe null/undefined devuelve tal cual.
 * - Si recibe string con 'T' (ej: '2024-01-02T00:00:00.000Z') trunca.
 * - Si recibe Date, formatea usando UTC components para evitar shift local.
 * No valida que el formato sea correcto: la validación ocurre a nivel de schema.
 */
function normalizeCivilDate(value){
  if (value == null) return value;
  if (value instanceof Date){
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth()+1).padStart(2,'0');
    const d = String(value.getUTCDate()).padStart(2,'0');
    return `${y}-${m}-${d}`;
  }
  if (typeof value === 'string'){
    if (value.includes('T')) return value.split('T')[0];
    return value;
  }
  return value; // no transformar otros tipos
}

/**
 * Mutación in-place opcional de un objeto que contenga `date_of_birth` u otro campo listado.
 */
function normalizeCivilDateFields(row, fields=['date_of_birth']){
  if (!row) return row;
  fields.forEach(f=>{
    if (Object.prototype.hasOwnProperty.call(row,f)){
      row[f] = normalizeCivilDate(row[f]);
    }
  });
  return row;
}

/**
 * Verifica que un string cumpla formato YYYY-MM-DD y que la combinación año-mes-día sea válida
 * (incluye control de meses 01-12, días correctos y años >= 0001). No aplica reglas de rango histórico.
 */
function isValidCivilDateString(str){
  if (typeof str !== 'string') return false;
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false; // formato
  const year = +m[1];
  const month = +m[2];
  const day = +m[3];
  if (month < 1 || month > 12) return false;
  const dim = [31, (year%4===0 && (year%100!==0 || year%400===0)) ? 29 : 28, 31,30,31,30,31,31,30,31,30,31];
  if (day < 1 || day > dim[month-1]) return false;
  return true;
}

module.exports = { normalizeCivilDate, normalizeCivilDateFields, isValidCivilDateString };
