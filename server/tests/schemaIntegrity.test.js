const { pool } = require('../db');

describe('Schema integrity', () => {
  test('analysis_parameters has position column and index', async () => {
    const colRes = await pool.query(`SELECT 1 FROM information_schema.columns WHERE table_name='analysis_parameters' AND column_name='position'`);
    expect(colRes.rowCount).toBe(1);
    const idxRes = await pool.query(`SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relname='idx_analysis_parameters_analysis_id_position' AND n.nspname='public'`);
    expect(idxRes.rowCount).toBe(1);
  });

  test('marketing tables have required columns after alignment migration', async () => {
    // ad_campaigns
    const adCols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='ad_campaigns'`);
    const adSet = adCols.rows.map(r=>r.column_name);
    ['platform','start_date','end_date','objectives','notes','kpis'].forEach(c=>expect(adSet).toContain(c));

    // social_media_posts
    const smCols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='social_media_posts'`);
    const smSet = smCols.rows.map(r=>r.column_name);
    ['content_type','media_url','hashtags','notes'].forEach(c=>expect(smSet).toContain(c));

    // seo_keywords
    const seoCols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='seo_keywords'`);
    const seoSet = seoCols.rows.map(r=>r.column_name);
    ['target_url','volume','difficulty','position','notes'].forEach(c=>expect(seoSet).toContain(c));

    // web_content
    const wcCols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='web_content'`);
    const wcSet = wcCols.rows.map(r=>r.column_name);
    ['author','publish_date','content','category','tags'].forEach(c=>expect(wcSet).toContain(c));

    // loyalty_programs
    const lpCols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='loyalty_programs'`);
    const lpSet = lpCols.rows.map(r=>r.column_name);
    ['type','rules','start_date','end_date','status'].forEach(c=>expect(lpSet).toContain(c));

    // loyalty_program_levels
    const lplCols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='loyalty_program_levels'`);
    const lplSet = lplCols.rows.map(r=>r.column_name);
    expect(lplSet).toContain('description');
  });
});
