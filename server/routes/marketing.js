const express = require('express');
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { AppError } = require('../utils/errors');
// db exports { pool }, ensure we use the actual Pool instance
const { pool } = require('../db');

const router = express.Router();

// Simple AI content generation placeholder
router.post('/generate', auth, requirePermission('marketing','access_marketing_tools'), async (req, res, next) => {
  const { prompt } = req.body || {};
  if (!prompt) return next(new AppError(400,'prompt requerido','PROMPT_REQUIRED'));
  try { res.json({ prompt, generated: `Contenido generado (placeholder) para: ${prompt.slice(0,80)}` }); }
  catch (e) { next(new AppError(500,'Error generando contenido','MARKETING_GEN_FAIL')); }
});

// --- Social Media Posts CRUD ---

// List posts (most recent first)
router.get('/social-posts', auth, requirePermission('marketing','access_marketing_tools'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM social_media_posts ORDER BY publish_date_time DESC NULLS LAST, created_at DESC LIMIT 1000`);
    res.json(rows);
  } catch (e) {
    next(new AppError(500,'Error obteniendo publicaciones','SOCIAL_POSTS_LIST_FAIL'));
  }
});

// Create post
router.post('/social-posts', auth, requirePermission('marketing','access_marketing_tools'), async (req, res, next) => {
  const { platform, publish_date_time, content, content_type, media_url, hashtags, status, notes, engagement } = req.body || {};
  if (!platform || !publish_date_time || !content) return next(new AppError(400,'platform, publish_date_time y content requeridos','SOCIAL_POSTS_VALIDATION'));
  try {
    const { rows } = await pool.query(
      `INSERT INTO social_media_posts (platform, publish_date_time, content, content_type, media_url, hashtags, status, notes, engagement, user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [platform, publish_date_time, content, content_type || 'Texto', media_url || null, hashtags || null, status || 'Borrador', notes || null, engagement || { likes:0, comments:0, shares:0, views:0 }, req.user?.id || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    next(new AppError(500,'Error creando publicación','SOCIAL_POST_CREATE_FAIL'));
  }
});

// Update post
router.put('/social-posts/:id', auth, requirePermission('marketing','access_marketing_tools'), async (req, res, next) => {
  const { id } = req.params;
  const { platform, publish_date_time, content, content_type, media_url, hashtags, status, notes, engagement } = req.body || {};
  try {
    const { rows } = await pool.query(
      `UPDATE social_media_posts SET
         platform = COALESCE($2, platform),
         publish_date_time = COALESCE($3, publish_date_time),
         content = COALESCE($4, content),
         content_type = COALESCE($5, content_type),
         media_url = $6,
         hashtags = $7,
         status = COALESCE($8, status),
         notes = $9,
         engagement = COALESCE($10, engagement)
       WHERE id = $1
       RETURNING *`,
      [id, platform, publish_date_time, content, content_type, media_url || null, hashtags || null, status, notes || null, engagement]
    );
    if (!rows[0]) return next(new AppError(404,'Publicación no encontrada','SOCIAL_POST_NOT_FOUND'));
    res.json(rows[0]);
  } catch (e) {
    next(new AppError(500,'Error actualizando publicación','SOCIAL_POST_UPDATE_FAIL'));
  }
});

// Archive post (status -> Archivada)
router.post('/social-posts/:id/archive', auth, requirePermission('marketing','access_marketing_tools'), async (req, res, next) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(`UPDATE social_media_posts SET status='Archivada' WHERE id=$1 RETURNING *`, [id]);
    if (!rows[0]) return next(new AppError(404,'Publicación no encontrada','SOCIAL_POST_NOT_FOUND'));
    res.json(rows[0]);
  } catch (e) {
    next(new AppError(500,'Error archivando publicación','SOCIAL_POST_ARCHIVE_FAIL'));
  }
});

// --- KPIs Endpoint (basic counts; UI simulates extra metrics) ---
router.get('/kpis', auth, requirePermission('marketing','access_marketing_tools'), async (req, res, next) => {
  const { from, to } = req.query;
  // Basic sanity: if not provided use last 30 days
  const toDate = to || new Date().toISOString();
  const fromDate = from || new Date(Date.now() - 30*24*60*60*1000).toISOString();
  try {
    const client = await pool.connect();
    try {
      const [newLeads, adCampaigns, socialPosts, emailCampaigns, seoKeywords, webContent] = await Promise.all([
        client.query(`SELECT COUNT(*)::int AS count FROM patients WHERE created_at BETWEEN $1 AND $2`, [fromDate, toDate]),
        client.query(`SELECT COUNT(*)::int AS count FROM ad_campaigns WHERE created_at BETWEEN $1 AND $2`, [fromDate, toDate]),
        client.query(`SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) AS posts FROM (
                        SELECT engagement FROM social_media_posts WHERE publish_date_time BETWEEN $1 AND $2
                      ) t`, [fromDate, toDate]),
        client.query(`SELECT COUNT(*)::int AS count FROM email_campaigns WHERE created_at BETWEEN $1 AND $2`, [fromDate, toDate]),
        client.query(`SELECT COUNT(*)::int AS count FROM seo_keywords`),
        client.query(`SELECT COUNT(*)::int AS count FROM web_content WHERE status='Publicado' AND created_at BETWEEN $1 AND $2`, [fromDate, toDate])
      ]);

      const posts = socialPosts.rows[0].posts;
      let totalEngagement = 0;
      posts.forEach(p => {
        const e = p.engagement || {};
        totalEngagement += (e.likes||0)+(e.comments||0)+(e.shares||0);
      });

      res.json({
        period: { from: fromDate, to: toDate },
        leadGeneration: { newLeads: newLeads.rows[0].count },
        campaignPerformance: { activeCampaigns: adCampaigns.rows[0].count },
        socialMedia: { postsPublished: posts.length, totalEngagement },
        emailMarketing: { campaignsSent: emailCampaigns.rows[0].count },
        seoPerformance: { trackedKeywords: seoKeywords.rows[0].count, publishedContent: webContent.rows[0].count }
      });
    } finally { client.release(); }
  } catch (e) {
    next(new AppError(500,'Error obteniendo KPIs','MARKETING_KPIS_FAIL'));
  }
});

// ========================= Loyalty Programs ============================= //

// List programs with levels
router.get('/loyalty/programs', auth, requirePermission('marketing','manage_loyalty_programs'), async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*, COALESCE(json_agg(l.*) FILTER (WHERE l.id IS NOT NULL),'[]') AS levels
      FROM loyalty_programs p
      LEFT JOIN loyalty_program_levels l ON l.program_id = p.id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `);
    res.json(rows);
  } catch (e) {
    next(new AppError(500,'Error listando programas de lealtad','LOYALTY_PROGRAMS_LIST_FAIL'));
  }
});

// Create program
router.post('/loyalty/programs', auth, requirePermission('marketing','manage_loyalty_programs'), async (req, res, next) => {
  const { name, type, description, rules, start_date, end_date, status } = req.body || {};
  if (!name || !type) return next(new AppError(400,'name y type requeridos','LOYALTY_PROGRAMS_VALIDATION_FAIL'));
  try {
    const { rows } = await pool.query(`
      INSERT INTO loyalty_programs (name, type, description, rules, start_date, end_date, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
    `, [name, type, description || null, rules || null, start_date || null, end_date || null, status || 'Borrador']);
    const program = rows[0];
    program.levels = [];
    res.status(201).json(program);
  } catch (e) {
    next(new AppError(500,'Error creando programa de lealtad','LOYALTY_PROGRAM_CREATE_FAIL'));
  }
});

// Update program
router.put('/loyalty/programs/:id', auth, requirePermission('marketing','manage_loyalty_programs'), async (req, res, next) => {
  const { id } = req.params;
  const { name, type, description, rules, start_date, end_date, status } = req.body || {};
  try {
    const { rows } = await pool.query(`
      UPDATE loyalty_programs SET
        name = COALESCE($2,name),
        type = COALESCE($3,type),
        description = $4,
        rules = $5,
        start_date = $6,
        end_date = $7,
        status = COALESCE($8,status)
      WHERE id = $1
      RETURNING *
    `, [id, name, type, description || null, rules || null, start_date || null, end_date || null, status]);
    if (!rows[0]) return next(new AppError(404,'Programa no encontrado','LOYALTY_PROGRAM_NOT_FOUND'));
    // Fetch levels
    const { rows: levelRows } = await pool.query('SELECT * FROM loyalty_program_levels WHERE program_id=$1 ORDER BY created_at ASC', [id]);
    const program = rows[0];
    program.levels = levelRows;
    res.json(program);
  } catch (e) {
    next(new AppError(500,'Error actualizando programa','LOYALTY_PROGRAM_UPDATE_FAIL'));
  }
});

// Create level under program
router.post('/loyalty/programs/:programId/levels', auth, requirePermission('marketing','manage_loyalty_programs'), async (req, res, next) => {
  const { programId } = req.params;
  const { name, points_required, rewards_desc } = req.body || {};
  if (!name || !rewards_desc) return next(new AppError(400,'name y rewards_desc requeridos','LOYALTY_LEVELS_VALIDATION_FAIL'));
  try {
    const { rows } = await pool.query(`
      INSERT INTO loyalty_program_levels (program_id, name, threshold, description)
      VALUES ($1,$2,$3,$4) RETURNING *
    `, [programId, name, points_required || null, rewards_desc || null]);
    res.status(201).json(rows[0]);
  } catch (e) {
    next(new AppError(500,'Error creando nivel','LOYALTY_LEVEL_CREATE_FAIL'));
  }
});

// Update level
router.put('/loyalty/levels/:id', auth, requirePermission('marketing','manage_loyalty_programs'), async (req, res, next) => {
  const { id } = req.params;
  const { name, points_required, rewards_desc } = req.body || {};
  try {
    const { rows } = await pool.query(`
      UPDATE loyalty_program_levels SET
        name = COALESCE($2,name),
        threshold = $3,
        description = $4
      WHERE id = $1
      RETURNING *
    `, [id, name, points_required || null, rewards_desc || null]);
    if (!rows[0]) return next(new AppError(404,'Nivel no encontrado','LOYALTY_LEVEL_NOT_FOUND'));
    res.json(rows[0]);
  } catch (e) {
    next(new AppError(500,'Error actualizando nivel','LOYALTY_LEVEL_UPDATE_FAIL'));
  }
});

// Delete level
router.delete('/loyalty/levels/:id', auth, requirePermission('marketing','manage_loyalty_programs'), async (req, res, next) => {
  const { id } = req.params;
  try {
    const { rowCount } = await pool.query('DELETE FROM loyalty_program_levels WHERE id=$1', [id]);
    if (!rowCount) return next(new AppError(404,'Nivel no encontrado','LOYALTY_LEVEL_NOT_FOUND'));
    res.json({ success: true });
  } catch (e) {
    next(new AppError(500,'Error eliminando nivel','LOYALTY_LEVEL_DELETE_FAIL'));
  }
});

// Participants listing (basic)
router.get('/loyalty/participants', auth, requirePermission('marketing','manage_loyalty_programs'), async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT lp.*, p.name AS program_name, l.name AS level_name
      FROM loyalty_participants lp
      LEFT JOIN loyalty_programs p ON p.id = lp.program_id
      LEFT JOIN loyalty_program_levels l ON l.id = lp.current_level_id
      ORDER BY lp.created_at DESC
      LIMIT 1000
    `);
    res.json(rows.map(r => ({
      ...r,
      program: { name: r.program_name },
      level: { name: r.level_name }
    })));
  } catch (e) {
    next(new AppError(500,'Error listando participantes','LOYALTY_PARTICIPANTS_LIST_FAIL'));
  }
});

// ========================= Email Marketing ============================= //

// Email Templates CRUD (simple)
router.get('/email/templates', auth, requirePermission('marketing','manage_email_marketing'), async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`SELECT id, name, subject, body, created_at FROM email_campaign_templates ORDER BY created_at DESC LIMIT 2000`);
    res.json(rows);
  } catch (e) { next(new AppError(500,'Error listando plantillas','EMAIL_TEMPLATES_LIST_FAIL')); }
});

router.post('/email/templates', auth, requirePermission('marketing','manage_email_marketing'), async (req, res, next) => {
  const { name, subject, body } = req.body || {};
  if (!name || !subject || !body) return next(new AppError(400,'name, subject y body requeridos','EMAIL_TEMPLATE_VALIDATION'));
  try {
    const { rows } = await pool.query(`INSERT INTO email_campaign_templates(name, subject, body) VALUES ($1,$2,$3) RETURNING *`, [name, subject, body]);
    res.status(201).json(rows[0]);
  } catch (e) { next(new AppError(500,'Error creando plantilla','EMAIL_TEMPLATE_CREATE_FAIL')); }
});

router.put('/email/templates/:id', auth, requirePermission('marketing','manage_email_marketing'), async (req, res, next) => {
  const { id } = req.params; const { name, subject, body } = req.body || {};
  try {
    const { rows } = await pool.query(`UPDATE email_campaign_templates SET name=COALESCE($2,name), subject=COALESCE($3,subject), body=COALESCE($4,body) WHERE id=$1 RETURNING *`, [id, name, subject, body]);
    if (!rows[0]) return next(new AppError(404,'Plantilla no encontrada','EMAIL_TEMPLATE_NOT_FOUND'));
    res.json(rows[0]);
  } catch (e) { next(new AppError(500,'Error actualizando plantilla','EMAIL_TEMPLATE_UPDATE_FAIL')); }
});

router.delete('/email/templates/:id', auth, requirePermission('marketing','manage_email_marketing'), async (req, res, next) => {
  const { id } = req.params; try {
    const { rowCount } = await pool.query(`DELETE FROM email_campaign_templates WHERE id=$1`, [id]);
    if (!rowCount) return next(new AppError(404,'Plantilla no encontrada','EMAIL_TEMPLATE_NOT_FOUND'));
    res.json({ success: true });
  } catch (e) { next(new AppError(500,'Error eliminando plantilla','EMAIL_TEMPLATE_DELETE_FAIL')); }
});

// Email Campaigns CRUD
router.get('/email/campaigns', auth, requirePermission('marketing','manage_email_marketing'), async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM email_campaigns ORDER BY created_at DESC LIMIT 2000`);
    res.json(rows);
  } catch (e) { next(new AppError(500,'Error listando campañas de email','EMAIL_CAMPAIGNS_LIST_FAIL')); }
});

router.post('/email/campaigns', auth, requirePermission('marketing','manage_email_marketing'), async (req, res, next) => {
  const { name, subject, body, list_id, template_id, send_date_time, status, metrics } = req.body || {};
  if (!name || !subject || !body) return next(new AppError(400,'name, subject y body requeridos','EMAIL_CAMPAIGN_VALIDATION'));
  try {
    const { rows } = await pool.query(`
      INSERT INTO email_campaigns(name, subject, body, status, list_id, template_id, send_date_time, metrics)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
    `, [name, subject, body, status || 'Borrador', list_id || null, template_id || null, send_date_time || null, metrics || {}]);
    res.status(201).json(rows[0]);
  } catch (e) { next(new AppError(500,'Error creando campaña de email','EMAIL_CAMPAIGN_CREATE_FAIL')); }
});

router.put('/email/campaigns/:id', auth, requirePermission('marketing','manage_email_marketing'), async (req, res, next) => {
  const { id } = req.params;
  const { name, subject, body, list_id, template_id, send_date_time, status, metrics } = req.body || {};
  try {
    const { rows } = await pool.query(`
      UPDATE email_campaigns SET
        name=COALESCE($2,name),
        subject=COALESCE($3,subject),
        body=COALESCE($4,body),
        status=COALESCE($5,status),
        list_id=$6,
        template_id=$7,
        send_date_time=$8,
        metrics=COALESCE($9,metrics)
      WHERE id=$1 RETURNING *
    `, [id, name, subject, body, status, list_id || null, template_id || null, send_date_time || null, metrics || null]);
    if (!rows[0]) return next(new AppError(404,'Campaña no encontrada','EMAIL_CAMPAIGN_NOT_FOUND'));
    res.json(rows[0]);
  } catch (e) { next(new AppError(500,'Error actualizando campaña','EMAIL_CAMPAIGN_UPDATE_FAIL')); }
});

router.delete('/email/campaigns/:id', auth, requirePermission('marketing','manage_email_marketing'), async (req, res, next) => {
  const { id } = req.params; try {
    const { rowCount } = await pool.query('DELETE FROM email_campaigns WHERE id=$1', [id]);
    if (!rowCount) return next(new AppError(404,'Campaña no encontrada','EMAIL_CAMPAIGN_NOT_FOUND'));
    res.json({ success: true });
  } catch (e) { next(new AppError(500,'Error eliminando campaña','EMAIL_CAMPAIGN_DELETE_FAIL')); }
});
// Subscribers CRUD
router.get('/email/subscribers', auth, requirePermission('marketing','manage_email_marketing'), async (_req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM subscribers ORDER BY created_at DESC LIMIT 2000');
    res.json(rows);
  } catch (e) { next(new AppError(500,'Error listando suscriptores','EMAIL_SUBSCRIBERS_LIST_FAIL')); }
});

router.post('/email/subscribers', auth, requirePermission('marketing','manage_email_marketing'), async (req, res, next) => {
  const { email, first_name, last_name } = req.body || {};
  if (!email) return next(new AppError(400,'email requerido','EMAIL_SUBSCRIBER_VALIDATION'));
  try {
    const { rows } = await pool.query(`INSERT INTO subscribers (email, name, status) VALUES ($1,$2,'Activo') RETURNING *`, [email, [first_name, last_name].filter(Boolean).join(' ').trim() || null]);
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return next(new AppError(409,'Email ya registrado','EMAIL_SUBSCRIBER_DUP')); 
    next(new AppError(500,'Error creando suscriptor','EMAIL_SUBSCRIBER_CREATE_FAIL'));
  }
});

router.put('/email/subscribers/:id', auth, requirePermission('marketing','manage_email_marketing'), async (req, res, next) => {
  const { id } = req.params; const { first_name, last_name } = req.body || {};
  try {
    const full = [first_name, last_name].filter(Boolean).join(' ').trim() || null;
    const { rows } = await pool.query('UPDATE subscribers SET name=$2 WHERE id=$1 RETURNING *', [id, full]);
    if (!rows[0]) return next(new AppError(404,'Suscriptor no encontrado','EMAIL_SUBSCRIBER_NOT_FOUND'));
    res.json(rows[0]);
  } catch (e) { next(new AppError(500,'Error actualizando suscriptor','EMAIL_SUBSCRIBER_UPDATE_FAIL')); }
});

router.delete('/email/subscribers/:id', auth, requirePermission('marketing','manage_email_marketing'), async (req, res, next) => {
  const { id } = req.params;
  try {
    const { rowCount } = await pool.query('DELETE FROM subscribers WHERE id=$1', [id]);
    if (!rowCount) return next(new AppError(404,'Suscriptor no encontrado','EMAIL_SUBSCRIBER_NOT_FOUND'));
    res.json({ success: true });
  } catch (e) { next(new AppError(500,'Error eliminando suscriptor','EMAIL_SUBSCRIBER_DELETE_FAIL')); }
});

// Lists CRUD
router.get('/email/lists', auth, requirePermission('marketing','manage_email_marketing'), async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT l.*, COALESCE(COUNT(els.id),0) AS subscriber_count
      FROM email_lists l
      LEFT JOIN email_list_subscribers els ON els.list_id = l.id
      GROUP BY l.id
      ORDER BY l.created_at DESC
    `);
    res.json(rows);
  } catch (e) { next(new AppError(500,'Error listando listas','EMAIL_LISTS_LIST_FAIL')); }
});

router.post('/email/lists', auth, requirePermission('marketing','manage_email_marketing'), async (req, res, next) => {
  const { name } = req.body || {};
  if (!name) return next(new AppError(400,'name requerido','EMAIL_LIST_VALIDATION'));
  try {
    const { rows } = await pool.query('INSERT INTO email_lists (name) VALUES ($1) RETURNING *',[name]);
    res.status(201).json(rows[0]);
  } catch (e) { next(new AppError(500,'Error creando lista','EMAIL_LIST_CREATE_FAIL')); }
});

router.put('/email/lists/:id', auth, requirePermission('marketing','manage_email_marketing'), async (req, res, next) => {
  const { id } = req.params; const { name } = req.body || {};
  try {
    const { rows } = await pool.query('UPDATE email_lists SET name=COALESCE($2,name) WHERE id=$1 RETURNING *',[id,name]);
    if (!rows[0]) return next(new AppError(404,'Lista no encontrada','EMAIL_LIST_NOT_FOUND'));
    res.json(rows[0]);
  } catch (e) { next(new AppError(500,'Error actualizando lista','EMAIL_LIST_UPDATE_FAIL')); }
});

router.delete('/email/lists/:id', auth, requirePermission('marketing','manage_email_marketing'), async (req, res, next) => {
  const { id } = req.params; try {
    const { rowCount } = await pool.query('DELETE FROM email_lists WHERE id=$1',[id]);
    if (!rowCount) return next(new AppError(404,'Lista no encontrada','EMAIL_LIST_NOT_FOUND'));
    res.json({ success: true });
  } catch (e) { next(new AppError(500,'Error eliminando lista','EMAIL_LIST_DELETE_FAIL')); }
});

// Manage list subscribers (replace all)
router.post('/email/lists/:id/subscribers', auth, requirePermission('marketing','manage_email_marketing'), async (req, res, next) => {
  const { id } = req.params; const { subscriberIds } = req.body || {};
  if (!Array.isArray(subscriberIds)) return next(new AppError(400,'subscriberIds array requerido','EMAIL_LIST_SUBSCRIBERS_VALIDATION'));
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM email_list_subscribers WHERE list_id=$1',[id]);
    if (subscriberIds.length) {
      const values = subscriberIds.map((s,i)=>`($1,$${i+2})`).join(',');
      await client.query(`INSERT INTO email_list_subscribers (list_id, subscriber_id) VALUES ${values}`, [id, ...subscriberIds]);
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (e) { await client.query('ROLLBACK'); next(new AppError(500,'Error actualizando suscriptores de la lista','EMAIL_LIST_SUBSCRIBERS_UPDATE_FAIL')); }
  finally { client.release(); }
});

// AI email generation placeholder (migrated from supabase function invoke)
router.post('/email/generate-template', auth, requirePermission('marketing','manage_email_marketing'), async (req, res, next) => {
  const { audience, topic, tone, labName, userName } = req.body || {};
  if (!audience || !topic) return next(new AppError(400,'audience y topic requeridos','EMAIL_AI_VALIDATION'));
  try {
    const subject = `[${labName||'Laboratorio'}] ${topic} para ${audience}`;
    const body = `Hola {{nombre_suscriptor}},\n\n${tone||'Información'} sobre ${topic} dirigida a ${audience}.\n\nAtentamente,\n${userName||'Equipo'}`;
    res.json({ subject, body });
  } catch (e) { next(new AppError(500,'Error generando plantilla','EMAIL_AI_GEN_FAIL')); }
});

// Retrieve subscribers ids for a list
router.get('/email/lists/:id/subscribers', auth, requirePermission('marketing','manage_email_marketing'), async (req, res, next) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query('SELECT subscriber_id FROM email_list_subscribers WHERE list_id=$1', [id]);
    res.json(rows.map(r => r.subscriber_id));
  } catch (e) { next(new AppError(500,'Error obteniendo suscriptores de lista','EMAIL_LIST_SUBSCRIBERS_GET_FAIL')); }
});

// ========================= Ad Campaigns ============================= //
router.get('/ad-campaigns', auth, requirePermission('marketing','manage_campaigns'), async (_req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM ad_campaigns ORDER BY created_at DESC LIMIT 1000');
    const normalized = rows.map(r => ({
      ...r,
      budget: typeof r.budget === 'number' ? r.budget : parseFloat(r.budget) || 0,
      kpis: {
        impressions: 0,
        clicks: 0,
        conversions: 0,
        ctr: '0%',
        cpc: '$0.00',
        cpa: '$0.00',
        ...(r.kpis || {})
      }
    }));
    res.json(normalized);
  } catch (e) { next(new AppError(500,'Error listando campañas','AD_CAMPAIGNS_LIST_FAIL')); }
});

router.post('/ad-campaigns', auth, requirePermission('marketing','manage_campaigns'), async (req, res, next) => {
  const { name, platform, start_date, end_date, budget, objectives, status, notes, kpis } = req.body || {};
  if (!name || !platform || !start_date || budget === undefined) return next(new AppError(400,'name, platform, start_date y budget requeridos','AD_CAMPAIGNS_VALIDATION'));
  const normalizedBudget = typeof budget === 'number' ? budget : parseFloat(budget) || 0;
  const mergedKpis = {
    impressions: 0,
    clicks: 0,
    conversions: 0,
    ctr: '0%',
    cpc: '$0.00',
    cpa: '$0.00',
    ...(kpis || {})
  };
  try {
    const { rows } = await pool.query(`
      INSERT INTO ad_campaigns (name, platform, start_date, end_date, budget, objectives, status, notes, kpis)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
    `,[name, platform, start_date, end_date || null, normalizedBudget, objectives || null, status || 'Planificada', notes || null, mergedKpis]);
    const created = rows[0];
    created.budget = normalizedBudget;
    created.kpis = mergedKpis;
    res.status(201).json(created);
  } catch (e) {
    console.error('AD_CAMPAIGN_CREATE_FAIL', e);
    next(new AppError(500,'Error creando campaña','AD_CAMPAIGN_CREATE_FAIL'));
  }
});

router.put('/ad-campaigns/:id', auth, requirePermission('marketing','manage_campaigns'), async (req, res, next) => {
  const { id } = req.params; const { name, platform, start_date, end_date, budget, objectives, status, notes, kpis } = req.body || {};
  const normalizedBudget = budget === undefined ? undefined : (typeof budget === 'number' ? budget : parseFloat(budget) || 0);
  const mergedKpis = kpis === undefined ? undefined : {
    impressions: 0,
    clicks: 0,
    conversions: 0,
    ctr: '0%',
    cpc: '$0.00',
    cpa: '$0.00',
    ...(kpis || {})
  };
  try {
    const { rows } = await pool.query(`
      UPDATE ad_campaigns SET
        name = COALESCE($2,name),
        platform = COALESCE($3,platform),
        start_date = COALESCE($4,start_date),
        end_date = $5,
        budget = COALESCE($6,budget),
        objectives = $7,
        status = COALESCE($8,status),
        notes = $9,
        kpis = COALESCE($10,kpis)
      WHERE id = $1 RETURNING *
    `,[id, name, platform, start_date, end_date || null, normalizedBudget, objectives || null, status, notes || null, mergedKpis]);
    if (!rows[0]) return next(new AppError(404,'Campaña no encontrada','AD_CAMPAIGN_NOT_FOUND'));
    const updated = rows[0];
    if (normalizedBudget !== undefined) updated.budget = normalizedBudget;
    if (mergedKpis !== undefined) updated.kpis = mergedKpis;
    res.json(updated);
  } catch (e) { next(new AppError(500,'Error actualizando campaña','AD_CAMPAIGN_UPDATE_FAIL')); }
});

router.post('/ad-campaigns/:id/archive', auth, requirePermission('marketing','manage_campaigns'), async (req, res, next) => {
  const { id } = req.params; try {
    const { rows } = await pool.query('UPDATE ad_campaigns SET status = $2 WHERE id=$1 RETURNING *',[id,'Archivada']);
    if (!rows[0]) return next(new AppError(404,'Campaña no encontrada','AD_CAMPAIGN_NOT_FOUND'));
    res.json(rows[0]);
  } catch (e) { next(new AppError(500,'Error archivando campaña','AD_CAMPAIGN_ARCHIVE_FAIL')); }
});

// ========================= SEO & Content ============================= //
router.get('/seo/keywords', auth, requirePermission('marketing','manage_seo_content'), async (_req, res, next) => {
  try { const { rows } = await pool.query('SELECT * FROM seo_keywords ORDER BY created_at DESC LIMIT 2000'); res.json(rows); }
  catch (e) { next(new AppError(500,'Error listando keywords','SEO_KEYWORDS_LIST_FAIL')); }
});

router.post('/seo/keywords', auth, requirePermission('marketing','manage_seo_content'), async (req, res, next) => {
  const { keyword, target_url, volume, difficulty, position, notes } = req.body || {};
  if (!keyword || !target_url) return next(new AppError(400,'keyword y target_url requeridos','SEO_KEYWORD_VALIDATION'));
  try {
    const { rows } = await pool.query(`INSERT INTO seo_keywords (keyword, target_url, volume, difficulty, position, notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,[keyword, target_url, volume || null, difficulty || null, position || null, notes || null]);
    res.status(201).json(rows[0]);
  } catch (e) { next(new AppError(500,'Error creando keyword','SEO_KEYWORD_CREATE_FAIL')); }
});

router.put('/seo/keywords/:id', auth, requirePermission('marketing','manage_seo_content'), async (req, res, next) => {
  const { id } = req.params; const { keyword, target_url, volume, difficulty, position, notes } = req.body || {};
  try {
    const { rows } = await pool.query(`
      UPDATE seo_keywords SET
        keyword = COALESCE($2, keyword),
        target_url = COALESCE($3, target_url),
        volume = $4,
        difficulty = $5,
        position = $6,
        notes = $7
      WHERE id = $1 RETURNING *`, [id, keyword, target_url, volume || null, difficulty || null, position || null, notes || null]);
    if (!rows[0]) return next(new AppError(404,'Keyword no encontrada','SEO_KEYWORD_NOT_FOUND'));
    res.json(rows[0]);
  } catch (e) { next(new AppError(500,'Error actualizando keyword','SEO_KEYWORD_UPDATE_FAIL')); }
});

router.get('/seo/content', auth, requirePermission('marketing','manage_seo_content'), async (_req, res, next) => {
  try { const { rows } = await pool.query('SELECT * FROM web_content ORDER BY created_at DESC LIMIT 1000'); res.json(rows); }
  catch (e) { next(new AppError(500,'Error listando contenido','SEO_CONTENT_LIST_FAIL')); }
});

router.post('/seo/content', auth, requirePermission('marketing','manage_seo_content'), async (req, res, next) => {
  const { title, author, publish_date, content, status, category, tags } = req.body || {};
  if (!title || !content) return next(new AppError(400,'title y content requeridos','SEO_CONTENT_VALIDATION'));
  try {
    const { rows } = await pool.query(`INSERT INTO web_content (title, author, publish_date, content, status, category, tags) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[title, author || null, publish_date || null, content, status || 'Borrador', category || null, tags || null]);
    res.status(201).json(rows[0]);
  } catch (e) { next(new AppError(500,'Error creando contenido','SEO_CONTENT_CREATE_FAIL')); }
});

router.put('/seo/content/:id', auth, requirePermission('marketing','manage_seo_content'), async (req, res, next) => {
  const { id } = req.params; const { title, author, publish_date, content, status, category, tags } = req.body || {};
  try {
    const { rows } = await pool.query(`
      UPDATE web_content SET
        title = COALESCE($2,title),
        author = $3,
        publish_date = $4,
        content = COALESCE($5, content),
        status = COALESCE($6,status),
        category = $7,
        tags = $8
      WHERE id = $1 RETURNING *`, [id, title, author || null, publish_date || null, content, status, category || null, tags || null]);
    if (!rows[0]) return next(new AppError(404,'Contenido no encontrado','SEO_CONTENT_NOT_FOUND'));
    res.json(rows[0]);
  } catch (e) { next(new AppError(500,'Error actualizando contenido','SEO_CONTENT_UPDATE_FAIL')); }
});

module.exports = router;
