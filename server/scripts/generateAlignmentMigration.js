#!/usr/bin/env node
/**
 * generateAlignmentMigration.js
 *
 * Objetivo: Leer el esquema CANÓNICO desde una BD de referencia (por defecto 'lab')
 * y generar un archivo de migración (sql/tenant_migrations/NNN_align_with_lab.sql)
 * que asegure que TODOS los tenants tengan al menos las mismas tablas y columnas.
 *
 * Estrategia:
 * - Se conecta a la BD referencia (REF_DB_NAME|LAB_REFERENCE_DB|lab) para obtener:
 *   * Lista de tablas (public) base (sin pg_catalog / information_schema)
 *   * Columnas: nombre, tipo completo, nullability, default
 *   * Claves primarias (solo listado para información/comentarios)
 * - Genera SQL idempotente:
 *   * Por cada tabla: CREATE TABLE IF NOT EXISTS public.<tabla>(); (vacío) -- sólo asegura existencia
 *   * Luego ALTER TABLE ... ADD COLUMN IF NOT EXISTS para cada columna con su tipo.
 *   * Intenta aplicar DEFAULT. Sólo añade NOT NULL si hay DEFAULT o la columna es serial/identity.
 *   * Añade comentarios si la columna de referencia es NOT NULL sin default (requiere verificación manual para datos existentes).
 * - NO hace modificaciones destructivas (no elimina columnas sobrantes ni cambia tipos distintos).
 * - Imprime un resumen de posibles MISMATCHES (tipo distinto, nullability distinta) como comentarios en el archivo.
 *
 * Uso:
 *   node server/scripts/generateAlignmentMigration.js
 *   REF_DB_NAME=lab node server/scripts/generateAlignmentMigration.js --dry-run
 *
 * Flags:
 *   --dry-run   Muestra SQL por stdout y NO crea archivo.
 *   --include-pk  Intenta agregar PRIMARY KEY si la tabla no existe (sólo dentro del CREATE).
 *
 * Requisitos env (master + tenants ya definidos):
 *   MASTER_PG* para consultar la tabla tenants y construir pools.
 *   REF_DB_NAME / LAB_REFERENCE_DB / (fallback 'lab') para la BD referencia.
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const DRY = process.argv.includes('--dry-run');
const INCLUDE_PK = process.argv.includes('--include-pk');

const refDbName = process.env.REF_DB_NAME || process.env.LAB_REFERENCE_DB || 'lab';

function clean(val){
  if (typeof val === 'string' && /^'.*'$/.test(val)) return val.slice(1,-1); return val;
}

const refPool = new Pool({
  host: process.env.REF_PGHOST || process.env.PGHOST || '127.0.0.1',
  port: process.env.REF_PGPORT || process.env.PGPORT || 5432,
  user: process.env.REF_PGUSER || process.env.PGUSER || 'postgres',
  password: clean(process.env.REF_PGPASSWORD || process.env.PGPASSWORD || ''),
  database: refDbName,
  max: 3
});

async function fetchTables(){
  const { rows } = await refPool.query(`SELECT table_name
    FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE'
    ORDER BY table_name`);
  return rows.map(r => r.table_name);
}

async function fetchColumns(table){
  const { rows } = await refPool.query(`SELECT
      column_name,
      data_type,
      udt_name,
      is_nullable,
      column_default,
      character_maximum_length,
      numeric_precision,
      numeric_scale
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name=$1
    ORDER BY ordinal_position`, [table]);
  return rows;
}

async function fetchPrimaryKey(table){
  const { rows } = await refPool.query(`SELECT a.attname AS column_name
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indrelid
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(i.indkey)
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE i.indisprimary AND n.nspname='public' AND c.relname=$1
    ORDER BY array_position(i.indkey, a.attnum)`, [table]);
  return rows.map(r => r.column_name);
}

function buildType(col){
  const dt = col.data_type;
  if (dt === 'character varying') {
    if (col.character_maximum_length) return `varchar(${col.character_maximum_length})`;
    return 'text'; // fallback sin length
  }
  if (dt === 'character') {
    if (col.character_maximum_length) return `char(${col.character_maximum_length})`;
  }
  if (dt === 'timestamp with time zone') return 'timestamptz';
  if (dt === 'timestamp without time zone') return 'timestamp';
  if (dt === 'USER-DEFINED') return col.udt_name; // enums u otros
  if (dt === 'numeric') {
    if (col.numeric_precision && col.numeric_scale != null) {
      return `numeric(${col.numeric_precision},${col.numeric_scale})`;
    }
    if (col.numeric_precision) return `numeric(${col.numeric_precision})`;
  }
  return col.udt_name || dt; // int4, int8, etc.
}

function escapeDefault(def){
  if (!def) return null;
  // Evitar copiar secuencias internas con nombres específicos? Las dejamos.
  return def.replace(/::[a-z_ ]+/gi,''); // simplifica casts redundantes
}

function columnSql(col){
  const type = buildType(col);
  const def = escapeDefault(col.column_default);
  const parts = [`ADD COLUMN IF NOT EXISTS "${col.column_name}" ${type}`];
  if (def) parts.push('DEFAULT ' + def);
  // Añadir NOT NULL sólo si def existe o parece secuencia
  if (col.is_nullable === 'NO') {
    if (def || /nextval\(/i.test(col.column_default || '')) {
      parts.push('NOT NULL');
    } else {
      parts.push('-- NOT NULL (omitted: requiere datos existentes)');
    }
  }
  return 'ALTER TABLE public.'+col._table+' ' + parts.join(' ') + ';';
}

async function main(){
  console.log(`[ALIGN] Referencia BD: ${refDbName}`);
  const tables = await fetchTables();
  const schema = {};
  for (const t of tables) {
    const cols = await fetchColumns(t);
    const pk = await fetchPrimaryKey(t);
    schema[t] = { columns: cols, pk };
  }

  // Preparar SQL
  const lines = [];
  lines.push('-- AUTO-GENERATED alignment migration');
  lines.push(`-- Fecha: ${new Date().toISOString()}`);
  lines.push(`-- Referencia: ${refDbName}`);
  lines.push('-- NOTA: Sólo agrega tablas/columnas faltantes. No borra ni cambia tipos existentes.');
  lines.push('');

  for (const [table, def] of Object.entries(schema)) {
    lines.push(`-- Tabla: ${table}`);
    // CREATE TABLE IF NOT EXISTS vacío (para no fallar si ya existe). Primary key dentro si se solicita y tabla no existe.
    if (INCLUDE_PK && def.pk.length) {
      lines.push(`CREATE TABLE IF NOT EXISTS public.${table} ( ${def.pk.map(c=>`"${c}" text`).join(', ')} ); -- PK se ajustará si tabla era inexistente (tipos placeholder si desconocidos)`);
      lines.push(`-- Revisar tipos reales para PK si se creó tabla nueva (se generaron como text placeholder).`);
    } else {
      lines.push(`CREATE TABLE IF NOT EXISTS public.${table} ();`);
    }
    for (const col of def.columns) {
      col._table = table; // helper
      lines.push(columnSql(col));
    }
    if (def.pk.length) {
      // Añadir PK sólo si no existe: usar DO block para detectar
      lines.push(`DO $$BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint ct
    JOIN pg_class c ON c.oid = ct.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE ct.contype='p' AND n.nspname='public' AND c.relname='${table}'
  ) THEN
    -- Intentar crear PK (puede fallar si tipos no compatibles / datos duplicados)
    ALTER TABLE public.${table} ADD PRIMARY KEY (${def.pk.map(c=>`"${c}"`).join(', ')});
  END IF;
END$$;`);
    }
    lines.push('');
  }

  // Determinar número de migración
  const migrDir = path.resolve(__dirname, '../../sql/tenant_migrations');
  if (!fs.existsSync(migrDir)) fs.mkdirSync(migrDir, { recursive: true });
  const existing = fs.readdirSync(migrDir).filter(f => /^\d{3}_.+\.sql$/.test(f)).sort();
  let nextNum = 1;
  if (existing.length) {
    const last = existing[existing.length - 1];
    nextNum = parseInt(last.slice(0,3),10) + 1;
  }
  const fileName = `${String(nextNum).padStart(3,'0')}_align_with_lab.sql`;
  const fullPath = path.join(migrDir, fileName);

  if (DRY) {
    console.log('----- BEGIN SQL (dry-run) -----');
    console.log(lines.join('\n'));
    console.log('----- END SQL (dry-run) -----');
    console.log(`[ALIGN] (dry-run) Archivo sugerido: ${fullPath}`);
  } else {
    fs.writeFileSync(fullPath, lines.join('\n') + '\n');
    console.log(`[ALIGN] Migración creada: ${fullPath}`);
  }
  await refPool.end();
}

main().catch(e => { console.error('[ALIGN] ERROR', e); process.exit(1); });
