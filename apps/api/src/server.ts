import {deviceRouter} from "./device.ts";
import express from 'express';
import { PrismaClient } from '@prisma/client';
import {scenario, weather, simulate, days} from './day-one.ts';
import {advance,enqueue,lockPump} from './queue.ts';
const app = express();
const db = new PrismaClient();
app.use("/api/devices/virtual-cam",deviceRouter(db));
app.get('/health/live', (_, res) => res.json({status:'ok'}));
app.get('/health/ready', async (_, res) => {
  try { await db.$queryRaw`SELECT 1`; res.json({status:'ready'}); }
  catch { res.status(503).json({status:'database unavailable'}); }
});
app.get('/api/farms/demo/zones', async (_, res) => {
  const zones = await db.zone.findMany({
    where: {pump: {farmId: 'demo'}}, orderBy: {id:'asc'},
    select: {id:true, name:true, virtualReadings:{orderBy:{observedAt:"desc"},take:1,select:{moisturePct:true,observedAt:true}}, simulatedDays:{where:{scenario},orderBy:{simulatedDate:"desc"},select:{simulatedDate:true,moisturePct:true,needsWater:true}}, pump:{select:{name:true}}, plantProfile:{select:{name:true,dryBelowPct:true}}}
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
      if(result.needsWater) await enqueue(tx,z,"AUTO");
      await tx.simulatedDay.create({data:{zoneId:z.id,scenario,simulatedDate,...result}});
    }
    return 200;
  });
  res.status(status).json(status===200 ? {source:'SIMULATION',scenario,weather:input} : {error:'Cần tạo vùng mẫu và chạy ngày trước đó'});
});
app.post('/api/farms/demo/simulation/reset', async (_, res) => {
  const allowed=await db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(527005)`;
    const pumps=await tx.pump.findMany({where:{farmId:"demo"},orderBy:{id:"asc"}});
    for(const pump of pumps) await lockPump(tx,pump.id);
    if(await tx.irrigation.count({where:{pump:{farmId:"demo"},requiresValveAck:true,status:"RUNNING"}})) return false;
    await tx.irrigation.deleteMany({where:{pump:{farmId:"demo"}}});
    await tx.simulatedDay.deleteMany({where:{scenario,zone:{pump:{farmId:'demo'}}}});
    return true;
  });
  res.sendStatus(allowed?204:409);
});
app.post('/api/farms/demo/zones/:id/irrigate',async(req,res)=>{
  const job=await db.$transaction(async tx=>{
    const z=await tx.zone.findFirst({where:{id:req.params.id,pump:{farmId:'demo'}}});
    return z?enqueue(tx,z,'MANUAL'):null;
  });
  res.status(job?200:404).json(job);
});
app.get('/api/farms/demo/queue',async(_,res)=>{
  res.json(await db.irrigation.findMany({where:{pump:{farmId:'demo'},status:{in:['RUNNING','PENDING']}},
    include:{zone:{select:{name:true}},pump:{select:{name:true}}},orderBy:[{pumpId:'asc'},{id:'asc'}]}));
});
app.get('/api/farms/demo/irrigation-history',async(req,res)=>{
  const zoneId=req.query.zoneId;
  if(zoneId!==undefined && typeof zoneId!=='string'){res.sendStatus(400);return;}
  const rows=await db.irrigation.findMany({
    where:{pump:{farmId:'demo'},status:'DONE',...(typeof zoneId==='string'?{zoneId}:{})},
    include:{zone:{select:{name:true}},pump:{select:{name:true}}},
    orderBy:[{finishAt:'desc'},{id:'desc'}],take:50
  });
  res.json(rows.map(({estimatedMl,...row})=>({...row,estimatedLiters:estimatedMl===null?null:Number(estimatedMl)/1000})));
});
async function tick(){
  try{
    const pumps=await db.irrigation.findMany({where:{status:{in:['RUNNING','PENDING']}},distinct:['pumpId'],select:{pumpId:true}});
    for(const {pumpId} of pumps) await db.$transaction(async tx=>{await lockPump(tx,pumpId); await advance(tx,pumpId);});
  }catch(error){console.error('Irrigation worker:',error);}
  finally{setTimeout(tick,1000).unref();}
}
void tick();
app.listen(Number(process.env.API_PORT ?? 4000));
