import express from 'express';
import { PrismaClient } from '@prisma/client';
import {scenario, weather, simulate, days} from './day-one.ts';
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
    select: {id:true, name:true, simulatedDays:{where:{scenario},orderBy:{simulatedDate:"desc"},select:{simulatedDate:true,moisturePct:true,needsWater:true}}, pump:{select:{name:true}}, plantProfile:{select:{name:true,dryBelowPct:true}}}
  });
  res.json(zones.map(z => ({...z, totalDays:days.length, simulatedDays:z.simulatedDays.map(d=>({
    ...d, rainMm:days[d.simulatedDate.getUTCDate()-1].rainMm
  }))})));
});
app.post(['/api/farms/demo/simulation/day-one','/api/farms/demo/simulation/days/:day'], async (req, res) => {
  const n = req.params.day === undefined ? 1 : Number(req.params.day);
  if (!Number.isInteger(n) || n < 1 || n > days.length) {
    res.status(400).json({error:'Ngày nằm ngoài kịch bản'}); return;
  }
  const input = days[n-1];
  const simulatedDate = new Date(input.date+'T00:00:00Z');
  const status = await db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(527005)`;
    const zones = await tx.zone.findMany({where:{pump:{farmId:'demo'}},include:{
      plantProfile:true, simulatedDays:{where:{scenario, simulatedDate:{lte:simulatedDate}},orderBy:{simulatedDate:'desc'},take:1}
    },orderBy:{id:'asc'}});
    if (!zones.length) return 409;
    const previous = n > 1 ? days[n-2].date : undefined;
    for (const z of zones) {
      const date = z.simulatedDays[0]?.simulatedDate.toISOString().slice(0,10);
      if (date !== input.date && date !== previous) return 409;
    }
    for (const z of zones) {
      const last = z.simulatedDays[0];
      if (last?.simulatedDate.getTime() === simulatedDate.getTime()) continue;
      const result = simulate(last?.moisturePct ?? weather.initialPct,input.rainMm,input.dryingPoints,z.plantProfile.dryBelowPct);
      await tx.simulatedDay.create({data:{zoneId:z.id,scenario,simulatedDate,...result}});
    }
    return 200;
  });
  res.status(status).json(status===200 ? {source:'SIMULATION',scenario,weather:input} : {error:'Cần tạo vùng mẫu và chạy ngày trước đó'});
});
app.post('/api/farms/demo/simulation/reset', async (_, res) => {
  await db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(527005)`;
    await tx.simulatedDay.deleteMany({where:{scenario,zone:{pump:{farmId:'demo'}}}});
  });
  res.sendStatus(204);
});
app.listen(Number(process.env.API_PORT ?? 4000));
