const express = require('express');
const { pool } = require('../db');
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { AppError } = require('../utils/errors');
const router = express.Router();

router.get('/', auth, requirePermission('administration','manage_roles'), async (_req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT role_name, permissions, is_system_role, created_at FROM roles_permissions ORDER BY role_name');
    res.json(rows);
  } catch (e) { next(new AppError(500,'Error listando roles','ROLES_LIST_FAIL')); }
});

module.exports = router;
