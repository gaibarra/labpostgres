#!/usr/bin/env node
const { pool } = require('../db');
(async () => {
  try {
    const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('users','profiles','roles_permissions') ORDER BY table_name");
    const exts = await pool.query("SELECT extname FROM pg_extension WHERE extname IN ('pgcrypto','uuid-ossp') ORDER BY extname");
    const uuidFns = await pool.query("SELECT proname FROM pg_proc WHERE proname IN ('gen_random_uuid','uuid_generate_v4') ORDER BY proname");
    console.log('tables:', tables.rows);
    console.log('extensions:', exts.rows);
    console.log('uuid_functions:', uuidFns.rows);
  } catch (e) {
    console.error('Introspection error:', e.message);
  } finally {
    await pool.end();
  }
})();
