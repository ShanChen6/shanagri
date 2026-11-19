import express from 'express';
import pg from 'pg';
const app = express();
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000});
app.get('/health/live', (_, res) => res.json({status:'ok'}));
app.get('/health/ready', async (_, res) => {
  try { await pool.query('SELECT 1'); res.json({status:'ready'}); }
  catch { res.status(503).json({status:'database unavailable'}); }
});
app.listen(Number(process.env.API_PORT ?? 4000));
