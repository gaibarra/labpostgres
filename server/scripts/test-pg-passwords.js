#!/usr/bin/env node
require('dotenv').config();
const { Pool } = require('pg');

const passwords = [process.env.PGPASSWORD, 'postgres', '6Vlgpcr&'].filter(Boolean);
const dbs = ['lab','postgres'];

(async () => {
  for (const pw of passwords) {
    for (const db of dbs) {
      const pool = new Pool({ host:'localhost', user:'postgres', password: pw, database: db });
      try {
        await pool.query('SELECT 1');
        console.log(`OK password='${pw}' db='${db}'`);
      } catch (e) {
        console.log(`FAIL password='${pw}' db='${db}' code=${e.code} msg=${e.message}`);
      } finally {
        await pool.end();
      }
    }
  }
})();
