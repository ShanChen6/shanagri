import express from 'express';
import { PrismaClient } from '@prisma/client';
import {scenario, weather, simulate} from './day-one.ts';
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
    select: {id:true, name:true, simulatedDays:{where:{scenario},orderBy:{simulatedDate:"desc"},take:1, select:{simulatedDate:true,moisturePct:true,needsWater:true}}, pump:{select:{name:true}}, plantProfile:{select:{name:true,dryBelowPct:true}}}
  });
  res.json(zones);
});
app.post('/api/farms/demo/simulation/day-one', async (_, res) => {
  const simulatedDate = new Date(weather.date+'T00:00:00Z');
  await db.$transaction(async tx => {
    const zones = await tx.zone.findMany({where:{pump:{farmId:'demo'}},include:{plantProfile:true},orderBy:{id:'asc'}});
    if (!zones.length) throw new Error('Demo farm requires seeded zones');
    for (const z of zones) {
      const result = simulate(weather.initialPct, weather.rainMm, weather.dryingPoints, z.plantProfile.dryBelowPct);
      await tx.simulatedDay.upsert({where:{zoneId_scenario_simulatedDate:{zoneId:z.id,scenario,simulatedDate}},
        create:{zoneId:z.id,scenario,simulatedDate,...result},update:result});
    }
  });
  res.json({source:'SIMULATION',scenario,weather});
});
app.listen(Number(process.env.API_PORT ?? 4000));
