#!/usr/bin/env node
/**
 * newTenantMigration.js
 * Crea un archivo de migración incremental para todas las bases tenant.
 * Uso:
 *   node server/scripts/newTenantMigration.js "add campo x a tabla y"
 * Genera: sql/tenant_migrations/00N_add_campo_x_a_tabla_y.sql
 */
const fs = require('fs');
const path = require('path');

const MIGR_DIR = path.resolve(__dirname, '../../sql/tenant_migrations');
if (!fs.existsSync(MIGR_DIR)) fs.mkdirSync(MIGR_DIR, { recursive: true });

const labelRaw = process.argv.slice(2).join(' ').trim();
if (!labelRaw) {
  console.error('Descripcion requerida. Ej: node .../newTenantMigration.js "add columna status"');
  process.exit(1);
}
const slug = labelRaw.toLowerCase()
  .replace(/[^a-z0-9]+/g,'_')
  .replace(/^_|_$/g,'')
  .slice(0,60);

const files = fs.readdirSync(MIGR_DIR).filter(f => /^\d{3}_.+\.sql$/.test(f));
const lastNum = files.map(f => parseInt(f.slice(0,3),10)).sort((a,b)=>a-b).pop() || 0;
const nextNum = String(lastNum + 1).padStart(3,'0');
const filename = `${nextNum}_${slug || 'migration'}.sql`;
const fullPath = path.join(MIGR_DIR, filename);

if (fs.existsSync(fullPath)) {
  console.error('Archivo ya existe:', fullPath);
  process.exit(1);
}

const template = `-- Migration: ${filename}\n-- Descripción original: ${labelRaw}\n-- Añade tus sentencias DDL a continuación. Ejemplos:\n-- ALTER TABLE alguna_tabla ADD COLUMN nueva_columna text;\n-- CREATE INDEX CONCURRENTLY si/no (evitar dentro de transacción si la herramienta la abre).\n\n`; 

fs.writeFileSync(fullPath, template, 'utf8');
console.log('Creado:', fullPath);
console.log('Edita el archivo y luego ejecuta:');
console.log('  sudo systemctl start labg40-migrations.service');