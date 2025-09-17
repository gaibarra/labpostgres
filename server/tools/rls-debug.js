(async ()=>{
  const { pool } = require('../db');
  const c = await pool.connect();
  const uid = process.env.DEBUG_UID || '70df19ac-470a-4a76-9436-b067cc562e15';
  const email = process.env.DEBUG_EMAIL || 'owner@example.com';
  const role = process.env.DEBUG_ROLE || 'Administrador';
  function logStep(name, extra){ console.log('[STEP]', name, extra||''); }
  try {
    await c.query('BEGIN');
    logStep('BEGIN');
    const claimsStr = JSON.stringify({ sub: uid, email, role }).replace(/'/g, "''");
    await c.query(`SELECT set_config('request.jwt.claims', '${claimsStr}', true)`);
    const show = await c.query('SHOW request.jwt.claims');
    logStep('SHOW_CLAIMS', show.rows);

    const hasTheme = await c.query("SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='theme'");
    logStep('HAS_THEME', hasTheme.rowCount);

    try {
      await c.query('SAVEPOINT sp1');
      await c.query("INSERT INTO public.profiles (id, email, role) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING", [uid, email, role]);
      await c.query('RELEASE SAVEPOINT sp1');
      logStep('INSERT_PROFILE_OK');
    } catch (e) {
      await c.query('ROLLBACK TO SAVEPOINT sp1');
      console.error('INSERT_PROFILE_ERR', e.code, e.message);
    }

    // Start new tx step to ensure not aborted
    await c.query('COMMIT');
    await c.query('BEGIN');
    const show2 = await c.query('SHOW request.jwt.claims');
    logStep('SHOW_CLAIMS_2', show2.rows);
    try {
      const sel = await c.query('SELECT theme FROM public.profiles WHERE id=$1', [uid]);
      logStep('SELECT_THEME_OK', sel.rows);
    } catch (e) {
      console.error('SELECT_THEME_ERR', e.code, e.message);
    }

    await c.query('COMMIT');
  } catch (e) {
    console.error('TX_ERR', e.code, e.message);
    try { await c.query('ROLLBACK'); } catch {}
  } finally {
    c.release();
    process.exit(0);
  }
})();
