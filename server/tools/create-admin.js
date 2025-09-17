#!/usr/bin/env node
// Crear usuario admin rápidamente: node tools/create-admin.js email password "Nombre Completo"
const bcrypt = require('bcryptjs');
const { pool } = require('../db');

async function main(){
  const [,, email, password, ...nameParts] = process.argv;
  if(!email || !password){
    console.error('Uso: node tools/create-admin.js email password "Nombre Completo"');
    process.exit(1);
  }
  const full_name = nameParts.join(' ') || 'Administrador';
  const hash = await bcrypt.hash(password, 10);
  try {
    const { rows } = await pool.query('INSERT INTO users(email,password_hash,full_name) VALUES($1,$2,$3) ON CONFLICT (email) DO UPDATE SET password_hash=EXCLUDED.password_hash RETURNING id,email,full_name',[email,hash,full_name]);
    const user = rows[0];
    // ensure profile
    await pool.query(`INSERT INTO profiles(id,email,full_name,role,user_id)
      VALUES($1,$2,$3,'Administrador',$1)
      ON CONFLICT (id) DO UPDATE SET email=EXCLUDED.email, full_name=EXCLUDED.full_name, role='Administrador'`, [user.id, user.email, user.full_name]);
    console.log('Admin listo:', user.email);
  } catch(e){
    console.error('Error creando admin:', e.message);
    process.exit(1);
  } finally { await pool.end(); }
}
main();