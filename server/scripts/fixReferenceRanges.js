#!/usr/bin/env node
/**
 * fixReferenceRanges.js
 * Etapa 1: Completar cobertura 0–18 años donde falte, sin tocar lo existente.
 * - Si existe rango adulto (Ambos 18–120) con lower/upper, lo copia para el gap pediátrico.
 * - Si no, inserta text_value: 'Interpretación pediátrica pendiente'.
 *
 * Uso (dry-run por defecto):
 *   node scripts/fixReferenceRanges.js --db=lab_gonzalo --terms="ALT (TGP),AST (TGO),GGT,Fosfatasa alcalina,Bilirrubina,Albúmina,Proteínas totales,LDH" [--write]
 */
const path = require('path');
try { require('dotenv').config({ path: path.resolve(__dirname, '../../.env') }); } catch (_) { try { require('dotenv').config(); } catch (_) { /* ignore */ } }
const { Pool } = require('pg');

function parseArgs(){
  const out={ write:false, fill:'pediatric', boundaries:false, sexSplit:false };
  for (const a of process.argv.slice(2)){
    const m=a.match(/^--([^=]+)=(.*)$/); if (m) out[m[1]] = m[2];
    if (a==='--write') out.write=true;
    if (a==='--boundaries' || a==='--fix-boundaries') out.boundaries=true;
    if (a==='--sex-split') out.sexSplit=true;
  }
  return out;
}

function buildFilterClause(terms){
  if (!terms) return { sql:'', params:[] };
  const arr = String(terms).split(',').map(s=>s.trim()).filter(Boolean);
  if (!arr.length) return { sql:'', params:[] };
  const conds=[]; const params=[];
  arr.forEach((t)=>{
    const p = `%${t}%`;
    conds.push(`a.name ILIKE $${params.length+1} OR ap.name ILIKE $${params.length+1}`);
    params.push(p);
  });
  return { sql: `WHERE ${conds.join(' OR ')}`, params };
}

function clamp(a){ return Math.max(0, Math.min(120, a)); }

async function main(){
  const args = parseArgs();
  const fillMode = String(args.fill||'pediatric').toLowerCase(); // 'pediatric' | 'adult' | 'both'
  const dbName = args.db || process.env.TENANT_DB || process.env.PGDATABASE;
  if (!dbName){ console.error('Falta --db'); process.exit(1); }
  const pool = new Pool({
    host: process.env.TENANT_PGHOST || process.env.PGHOST,
    port: process.env.TENANT_PGPORT || process.env.PGPORT || 5432,
    user: process.env.TENANT_PGUSER || process.env.PGUSER,
    password: process.env.TENANT_PGPASSWORD || process.env.PGPASSWORD,
    database: dbName,
  });
  try {
    const { sql, params } = buildFilterClause(args.terms);
  const q = `
      SELECT a.id aid, a.name aname, ap.id pid, ap.name pname,
             COALESCE(ap.unit, a.general_units) unit,
       arr.sex, arr.age_min, arr.age_max, arr.lower, arr.upper, arr.text_value, arr.method
      FROM analysis a
      JOIN analysis_parameters ap ON ap.analysis_id = a.id
      LEFT JOIN analysis_reference_ranges arr ON arr.parameter_id = ap.id
      ${sql}
      ORDER BY a.name, ap.position NULLS LAST, ap.name
    `;
    const { rows } = await pool.query(q, params);
    const byParam = new Map();
    for (const r of rows){
      if (!byParam.has(r.pid)) byParam.set(r.pid, { aid:r.aid, aname:r.aname, pid:r.pid, pname:r.pname, unit:r.unit, ranges:[] });
      if (r.sex!=null || r.age_min!=null || r.age_max!=null || r.lower!=null || r.upper!=null || r.text_value!=null){
        byParam.get(r.pid).ranges.push({ sex:r.sex||'Ambos', a0:r.age_min??0, a1:r.age_max??120, lower:r.lower, upper:r.upper, text:r.text_value, method:r.method||null });
      }
    }
    const actions=[];
  for (const p of byParam.values()){
      const toInsert=[];

      // Pediatric fill (0–18)
      if (fillMode==='pediatric' || fillMode==='both'){
        // buscar adulto Ambos 18–120 numérico como plantilla
        const adultTpl = p.ranges.find(r=> (r.sex||'Ambos').toLowerCase().startsWith('a') && r.a0<=18 && r.a1>=120 && r.lower!=null && r.upper!=null);
        const pedIntervals = p.ranges.map(r=>[clamp(r.a0), clamp(r.a1)]).filter(([s,e])=> e>0 && s<18);
        pedIntervals.sort((x,y)=> x[0]-y[0] || x[1]-y[1]);
        const merged=[]; let cur=null;
        for (const iv of pedIntervals){
          if (!cur) cur=[iv[0], iv[1]]; else if (iv[0] <= cur[1]) cur[1]=Math.max(cur[1], iv[1]); else { merged.push(cur); cur=[iv[0], iv[1]]; }
        }
        if (cur) merged.push(cur);
        const gaps=[]; let c=0;
        for (const [s,e] of merged){ if (s>c) gaps.push([c, Math.min(s,18)]); c=Math.max(c,e); }
        if (c<18) gaps.push([c,18]);
        for (const [a,b] of gaps.filter(([a,b])=> b>a)){
          toInsert.push({ a0:a, a1:b, lower: adultTpl?.lower ?? null, upper: adultTpl?.upper ?? null, text: adultTpl ? null : 'Interpretación pediátrica pendiente', unit:p.unit });
        }
      }

      // Adult fill with life stages (18–64, 65–120)
      if (fillMode==='adult' || fillMode==='both'){
        const adultIntervals = p.ranges.map(r=>[clamp(r.a0), clamp(r.a1)]).filter(([s,e])=> e>18 && s<120);
        adultIntervals.sort((x,y)=> x[0]-y[0] || x[1]-y[1]);
        const mergedA=[]; let curA=null;
        for (const iv of adultIntervals){
          if (!curA) curA=[iv[0], iv[1]]; else if (iv[0] <= curA[1]) curA[1]=Math.max(curA[1], iv[1]); else { mergedA.push(curA); curA=[iv[0], iv[1]]; }
        }
        if (curA) mergedA.push(curA);
        // gaps in 18–120
        const gapsA=[]; let cA=18;
        for (const [s,e] of mergedA){ if (s>cA) gapsA.push([cA, Math.min(s,120)]); cA=Math.max(cA,e); }
        if (cA<120) gapsA.push([cA,120]);
        // split by life stages
        const stages=[[18,64],[65,120]];
        const splitGaps=[];
        for (const [ga,gb] of gapsA){
          for (const [sa,sb] of stages){
            const ia=Math.max(ga, sa); const ib=Math.min(gb, sb);
            if (ib>ia) splitGaps.push([ia,ib]);
          }
        }
        for (const [a,b] of splitGaps){
          toInsert.push({ a0:a, a1:b, lower: null, upper: null, text: a>=65 ? 'Interpretación adulto (65+) pendiente' : 'Interpretación adulto pendiente', unit:p.unit });
        }
      }

      // Boundary fixes for 12–13, 17–18, 64–65
      if (args.boundaries){
        const targets=[[12,13],[17,18],[64,65]];
        // Build merged coverage across all sexes
        const all = p.ranges.map(r=>[clamp(r.a0), clamp(r.a1)]).filter(([s,e])=> e>0 && s<120).sort((x,y)=> x[0]-y[0] || x[1]-y[1]);
        const merged=[]; let cur=null;
        for (const iv of all){ if (!cur) cur=[iv[0],iv[1]]; else if (iv[0]<=cur[1]) cur[1]=Math.max(cur[1], iv[1]); else { merged.push(cur); cur=[iv[0],iv[1]]; } }
        if (cur) merged.push(cur);
        const covered = (a,b)=> merged.some(([s,e])=> a>=s && b<=e);
        const pickTemplate = (a,b)=>{
          // prefer numeric overlapping adult template if any
          const num = p.ranges.find(r=> r.lower!=null && r.upper!=null && !(r.a1<=a || r.a0>=b));
          return num ? { lower:num.lower, upper:num.upper, text:null } : { lower:null, upper:null, text:'Interpretación por edad pendiente' };
        };
        for (const [ba,bb] of targets){
          if (!covered(ba,bb)){
            const tpl = pickTemplate(ba,bb);
            toInsert.push({ a0:ba, a1:bb, lower: tpl.lower, upper: tpl.upper, text: tpl.text, unit:p.unit });
          }
        }
      }

      if (toInsert.length){ actions.push({ aname:p.aname, pname:p.pname, unit:p.unit, inserts: toInsert, pid:p.pid }); }
    }

    if (!actions.length){
      console.log('[FIX] No hay gaps en 0–18 para los términos dados.');
      return;
    }

    console.log('Análisis\tParámetro\tUnidad\tInserciones propuestas');
    for (const a of actions){
      console.log(`${a.aname}\t${a.pname}\t${a.unit||''}\t${a.inserts.map(x=>`[${x.a0}–${x.a1} ${x.text?('text:"'+x.text+'"'):(x.lower+'–'+x.upper)}]`).join(', ')}`);
    }

    // Sex-split mode: duplicate adult Ambos ranges into M/F using current values
    if (args.sexSplit){
      const splitTerms = (args.terms ? String(args.terms) : '').toLowerCase();
      const targets = Array.from(byParam.values()).filter(p=>{
        const key = (p.aname + ' ' + p.pname).toLowerCase();
        return !splitTerms || splitTerms.split(',').map(s=>s.trim()).filter(Boolean).some(t=> key.includes(t));
      });
      const makeInserts=[];
      for (const p of targets){
        for (const r of p.ranges){
          const sex=(r.sex||'Ambos').toLowerCase();
          if (sex.startsWith('a')){
            // Split only adult portion >=13
            const a0 = Math.max(13, clamp(r.a0));
            const a1 = clamp(r.a1);
            if (a1>a0){
              // Check if M/F exist overlapping
              const hasM = p.ranges.some(x=> (x.sex||'').toLowerCase().startsWith('m') && !(x.a1<=a0 || x.a0>=a1));
              const hasF = p.ranges.some(x=> (x.sex||'').toLowerCase().startsWith('f') && !(x.a1<=a0 || x.a0>=a1));
              if (!hasM) makeInserts.push({ pid:p.pid, a0, a1, lower:r.lower, upper:r.upper, text:r.text, unit:p.unit, sex:'Masculino', aname:p.aname, pname:p.pname });
              if (!hasF) makeInserts.push({ pid:p.pid, a0, a1, lower:r.lower, upper:r.upper, text:r.text, unit:p.unit, sex:'Femenino', aname:p.aname, pname:p.pname });
            }
          }
        }
      }
  if (makeInserts.length){
        console.log('Análisis\tParámetro\tUnidad\tSplit M/F');
        for (const m of makeInserts){
          console.log(`${m.aname}\t${m.pname}\t${m.unit||''}\t[${m.sex} ${m.a0}–${m.a1} ${m.text?('text:"'+m.text+'"'):(m.lower+'–'+m.upper)}]`);
        }
        if (args.write){
          let total=0;
          for (const m of makeInserts){
            await pool.query(`INSERT INTO analysis_reference_ranges(parameter_id, sex, age_min, age_max, age_min_unit, lower, upper, text_value, unit)
                              VALUES ($1,$2,$3,$4,'años',$5,$6,$7,$8)`,
                            [m.pid, m.sex, m.a0, m.a1, m.lower, m.upper, m.text, m.unit]);
            total++;
          }
          console.log(`[FIX] Insertadas ${total} filas (split por sexo).`);
        } else {
          console.log('\n[FIX] Dry-run split: use --write para aplicar.');
        }
      } else {
        console.log('[FIX] No hay filas calificadas para split por sexo.');
      }
      return;
    }

    if (args.write){
      let total=0;
      for (const a of actions){
        for (const ins of a.inserts){
          await pool.query(`INSERT INTO analysis_reference_ranges(parameter_id, sex, age_min, age_max, age_min_unit, lower, upper, text_value, unit)
                            VALUES ($1,'Ambos',$2,$3,'años',$4,$5,$6,$7)`,
                          [a.pid, ins.a0, ins.a1, ins.lower, ins.upper, ins.text, ins.unit]);
          total++;
        }
      }
      console.log(`[FIX] Insertadas ${total} filas en analysis_reference_ranges.`);
    } else {
      console.log('\n[FIX] Dry-run: use --write para aplicar.');
    }
  } catch (e){
    console.error('[FIX] Error:', e.message);
    process.exit(1);
  } finally { await pool.end(); }
}

if (require.main === module){ main(); }
