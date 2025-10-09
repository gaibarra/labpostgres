#!/usr/bin/env node
const { Pool } = require('pg');
const path = require('path');
try { require('dotenv').config({ path: path.resolve(__dirname, '../../.env') }); } catch(_) { /* optional .env */ }

function parseArgs(){
  const out={};
  process.argv.slice(2).forEach(a=>{ const m=a.match(/^--([^=]+)=(.*)$/); if(m) out[m[1]]=m[2]; });
  return out;
}

const CATALOG = [
  { code:'AMX', name:'Amoxicilina', class:'Penicilina' },
  { code:'AMC', name:'Amoxicilina/Ac. Clavulánico', class:'Penicilina + Inhibidor' },
  { code:'AMP', name:'Ampicilina', class:'Penicilina' },
  { code:'CXM', name:'Cefuroxima', class:'Cefalosporina 2ª' },
  { code:'CRO', name:'Ceftriaxona', class:'Cefalosporina 3ª' },
  { code:'CTX', name:'Cefotaxima', class:'Cefalosporina 3ª' },
  { code:'FEP', name:'Cefepima', class:'Cefalosporina 4ª' },
  { code:'CIP', name:'Ciprofloxacino', class:'Fluoroquinolona' },
  { code:'LVX', name:'Levofloxacino', class:'Fluoroquinolona' },
  { code:'GEN', name:'Gentamicina', class:'Aminoglucósido' },
  { code:'AK',  name:'Amikacina', class:'Aminoglucósido' },
  { code:'SXT', name:'Trimetoprim/Sulfametoxazol', class:'Sulfonamida' },
  { code:'TZP', name:'Piperacilina/Tazobactam', class:'Penicilina + Inhibidor' },
  { code:'MEM', name:'Meropenem', class:'Carbapenem' },
  { code:'ETP', name:'Ertapenem', class:'Carbapenem' },
  { code:'CAZ', name:'Ceftazidima', class:'Cefalosporina 3ª' },
  { code:'FOX', name:'Cefoxitina', class:'Cefamicina' },
  { code:'DOX', name:'Doxiciclina', class:'Tetraciclina' },
  { code:'AZM', name:'Azitromicina', class:'Macrólido' },
  { code:'ERY', name:'Eritromicina', class:'Macrólido' },
  { code:'CLI', name:'Clindamicina', class:'Lincosamida' },
  { code:'VAN', name:'Vancomicina', class:'Glicopéptido' },
  { code:'TEC', name:'Teicoplanina', class:'Glicopéptido' },
  { code:'LNZ', name:'Linezolid', class:'Oxitazolidinona' }
];

async function seedAntibiotics(dbName){
  const pool = new Pool({
    host: process.env.TENANT_PGHOST || process.env.PGHOST,
    port: process.env.TENANT_PGPORT || process.env.PGPORT || 5432,
    user: process.env.TENANT_PGUSER || process.env.PGUSER,
    password: process.env.TENANT_PGPASSWORD || process.env.PGPASSWORD,
    database: dbName
  });
  try {
    const { rows } = await pool.query(`SELECT to_regclass('public.antibiotics') AS t`);
    if (!rows[0].t) { console.log('[ANTIBIOTICS] Tabla no existe en %s, omitiendo', dbName); return; }
    for (const ab of CATALOG){
      await pool.query(`INSERT INTO antibiotics(code, name, class, is_active) VALUES($1,$2,$3,true)
        ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, class=EXCLUDED.class, is_active=true`, [ab.code, ab.name, ab.class]);
    }
    console.log('[ANTIBIOTICS] Catálogo aplicado en', dbName);
  } finally {
    await pool.end();
  }
}

async function main(){
  const { db } = parseArgs();
  if (!db) { console.error('Uso: node server/scripts/seedAntibiotics.js --db=lab_mitenant'); process.exit(1); }
  await seedAntibiotics(db);
}

if (require.main === module) main();

module.exports = { seedAntibiotics };
