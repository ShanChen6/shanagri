import express from 'express';
import { PrismaClient } from '@prisma/client';
const app = express();
const db = new PrismaClient();
app.get('/health/live', (_, res) => res.json({status:'ok'}));
app.get('/health/ready', async (_, res) => {
  try { await db.$queryRaw`SELECT 1`; res.json({status:'ready'}); }
  catch { res.status(503).json({status:'database unavailable'}); }
});
app.get('/api/farms/demo/zones', async (_, res) => {
  const zones = await db.zone.findMany({
    where: {pump: {farmId: 'demo'}}, orderBy: {id:'asc'},
    select: {id:true, name:true, pump:{select:{name:true}}, plantProfile:{select:{name:true,dryBelowPct:true}}}
  });
  res.json(zones);
});
app.listen(Number(process.env.API_PORT ?? 4000));
