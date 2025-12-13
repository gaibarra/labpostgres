const { pool } = require('../db');

let systemParametersPromise = null;
let analysisParametersPromise = null;

async function ensureSystemParametersStore() {
  if (!systemParametersPromise) {
    systemParametersPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS system_parameters (
          id uuid PRIMARY KEY DEFAULT (md5(random()::text || clock_timestamp()::text))::uuid,
          name text NOT NULL,
          value text,
          created_at timestamptz DEFAULT now(),
          updated_at timestamptz DEFAULT now()
        )
      `);
      await pool.query(`
        ALTER TABLE system_parameters
          ADD COLUMN IF NOT EXISTS name text,
          ADD COLUMN IF NOT EXISTS value text,
          ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
          ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now()
      `);
      const columnInfo = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name='system_parameters'
      `);
      const columnNames = columnInfo.rows.map(r => r.column_name);
      if (columnNames.includes('key')) {
        await pool.query(`
          UPDATE system_parameters
          SET name = COALESCE(name, "key")
          WHERE "key" IS NOT NULL
        `);
        await pool.query('ALTER TABLE system_parameters DROP COLUMN IF EXISTS "key"');
      }
      await pool.query(`
        UPDATE system_parameters
        SET name = CONCAT('legacy_param_', id::text)
        WHERE name IS NULL OR name = ''
      `);
      await pool.query('ALTER TABLE system_parameters ALTER COLUMN name SET NOT NULL');
      const valueTypeRes = await pool.query(`
        SELECT data_type
        FROM information_schema.columns
        WHERE table_name='system_parameters' AND column_name='value'
      `);
      if (valueTypeRes.rows[0] && valueTypeRes.rows[0].data_type !== 'text') {
        await pool.query('ALTER TABLE system_parameters ALTER COLUMN value TYPE text USING value::text');
      }
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS uq_system_parameters_name_ci
          ON system_parameters ((LOWER(name)))
      `);
    })().catch(err => {
      systemParametersPromise = null;
      throw err;
    });
  }
  return systemParametersPromise;
}

async function ensureAnalysisParameterPositionIndex() {
  if (!analysisParametersPromise) {
    analysisParametersPromise = (async () => {
      const { rows } = await pool.query(`SELECT to_regclass('public.analysis_parameters') AS exists`);
      if (!rows[0] || !rows[0].exists) return;
      await pool.query('ALTER TABLE analysis_parameters ADD COLUMN IF NOT EXISTS position int');
      await pool.query(`
        WITH ordered AS (
          SELECT id,
                 ROW_NUMBER() OVER (
                   PARTITION BY analysis_id
                   ORDER BY created_at, name
                 ) AS rn
          FROM analysis_parameters
          WHERE position IS NULL
        )
        UPDATE analysis_parameters ap
        SET position = o.rn
        FROM ordered o
        WHERE ap.id = o.id
      `);
      await pool.query('CREATE INDEX IF NOT EXISTS idx_analysis_parameters_analysis_id_position ON analysis_parameters(analysis_id, position)');
    })().catch(err => {
      analysisParametersPromise = null;
      throw err;
    });
  }
  return analysisParametersPromise;
}

async function ensureCoreSchemaArtifacts() {
  await Promise.all([
    ensureSystemParametersStore(),
    ensureAnalysisParameterPositionIndex(),
  ]);
}

module.exports = {
  ensureSystemParametersStore,
  ensureAnalysisParameterPositionIndex,
  ensureCoreSchemaArtifacts,
};
