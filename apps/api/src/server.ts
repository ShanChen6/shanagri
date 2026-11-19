import {holdRoutes,sweep,ready,mac,phoneNumber,pin,deliver} from './holds.ts';
import {createHash} from 'node:crypto';
import {ownerOrders} from "./owner-orders.ts";
import {deviceRouter} from "./device.ts";
import express from 'express';
import { PrismaClient } from '@prisma/client';
import {scenario, weather, simulate, days} from './day-one.ts';
import {advance,enqueue,lockPump} from './queue.ts';
const app = express();
const db = new PrismaClient();
app.use("/api/public/hold",holdRoutes(db));
app.use("/api/farms/demo/owner/orders",ownerOrders(db));
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
      if(result.needsWater) await enqueue(tx,z,"AUTO",scenario,simulatedDate);
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
    if(!z)return null;
    const latest=await tx.simulatedDay.findFirst({where:{zoneId:z.id,scenario},orderBy:{simulatedDate:'desc'}});
    return enqueue(tx,z,'MANUAL',scenario,latest?.simulatedDate??new Date(days[0].date+'T00:00:00Z'));
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
    await sweep(db);
    const pumps=await db.irrigation.findMany({where:{status:{in:['RUNNING','PENDING']}},distinct:['pumpId'],select:{pumpId:true}});
    for(const {pumpId} of pumps) await db.$transaction(async tx=>{await lockPump(tx,pumpId); await advance(tx,pumpId);});
  }catch(error){console.error('Irrigation worker:',error);}
  finally{setTimeout(tick,1000).unref();}
}
void tick();
app.get('/api/public/market',async(req,res)=>{
  const sort=req.query.sort??'harvest';
  if(sort!=='harvest' && sort!=='price'){res.sendStatus(400);return;}
  const offers=await db.offer.findMany({where:{open:true,OR:[{closesAt:null},{closesAt:{gt:new Date()}}],remainingKg:{gt:0},batch:{published:true}},
    orderBy:sort==='price'?[{priceVnd:'asc'},{batchId:'asc'}]:[{batch:{expectedHarvestDate:'asc'}},{batchId:'asc'}],
    select:{batchId:true,closesAt:true,priceVnd:true,remainingKg:true,batch:{select:{name:true,expectedHarvestDate:true,zone:{select:{pump:{select:{farm:{select:{name:true}}}}}}}}}});
  res.set('Cache-Control','no-store').json(offers.map(o=>({code:o.batchId,closesAt:o.closesAt,name:o.batch.name,farm:o.batch.zone.pump.farm.name,
    expectedHarvestDate:o.batch.expectedHarvestDate,priceVnd:o.priceVnd,remainingKg:o.remainingKg})));
});
app.get('/api/public/batches/:code',async(req,res)=>{
  const batch=await db.batch.findFirst({where:{id:req.params.code,published:true},include:{offer:{select:{batchId:true,totalKg:true,remainingKg:true,priceVnd:true,open:true,closesAt:true,harvestDate:true}},zone:{include:{pump:{include:{farm:true}}}}}});
  if(!batch){res.sendStatus(404);return;}
  const history=await db.simulatedDay.findMany({where:{zoneId:batch.zoneId,scenario:batch.scenario,
    simulatedDate:{gte:batch.startDate,lte:batch.expectedHarvestDate}},orderBy:{simulatedDate:'asc'},
    select:{simulatedDate:true,moisturePct:true,needsWater:true}});
  const completed=await db.irrigation.findMany({where:{batchId:batch.id,status:'DONE'},orderBy:{id:'asc'},
    select:{id:true,source:true,requestDay:true,closedAt:true,finishAt:true,estimatedMl:true}});
  const irrigations=completed.map(r=>({id:r.id,source:r.source,requestDay:r.requestDay,completedAt:r.closedAt??r.finishAt,
    estimatedLiters:r.estimatedMl===null?null:Number(r.estimatedMl)/1000}));
  res.json({offer:batch.offer,irrigations,code:batch.id,name:batch.name,farm:batch.zone.pump.farm.name,zone:batch.zone.name,startDate:batch.startDate,
    expectedHarvestDate:batch.expectedHarvestDate,source:'SIMULATION',history});
});
const digest=(token:string)=>createHash('sha256').update(token).digest('hex');
app.get('/api/public/order-lookup',async(req,res)=>{
  res.set('Cache-Control','no-store');
  const token=req.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if(!token){res.sendStatus(404);return;}
  const order=await db.preorder.findUnique({where:{lookupHash:digest(token)},select:{expiresAt:true,cancelRequested:true,allocatedKg:true,id:true,kg:true,priceVnd:true,status:true,
    batchId:true,offer:{select:{batch:{select:{name:true}}}}}});
  if(!order){res.sendStatus(404);return;}
  const {offer,...receipt}=order;
  res.json({...receipt,name:offer.batch.name,totalVnd:order.kg*order.priceVnd});
});
app.post('/api/public/batches/:code/preorders',express.json({limit:'2kb'}),async(req,res)=>{
  const {id,kg,lookupToken}=req.body??{};
  if(lookupToken!==undefined && (typeof lookupToken!=='string'||!/^[a-f0-9]{64}$/.test(lookupToken))){res.sendStatus(400);return;}
  const phone=phoneNumber(req.body.phone);
  if(!phone||!lookupToken){res.sendStatus(400);return;}
  if(!ready()){res.status(503).json({error:'SMS_UNAVAILABLE'});return;}
  const lookupHash=digest(lookupToken),phoneHash=mac('phone:'+phone),otp=pin();
  if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)||!Number.isSafeInteger(kg)||kg<1||kg>1000){res.sendStatus(400);return;}
  const batchId=req.params.code;
  const result=await db.$transaction(async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id.toLowerCase()}))`;
    const rows=await tx.$queryRaw<{priceVnd:number;remainingKg:number;open:boolean;closesAt:Date|null}[]>`SELECT o.* FROM "Offer" o JOIN "Batch" b ON b.id=o."batchId" WHERE b.published AND b.id=${batchId} FOR UPDATE OF o`;
    if(!rows.length)return {status:404};
    const prior=await tx.preorder.findUnique({where:{id}});
    if(prior && ['CANCELLED','EXPIRED'].includes(prior.status))return {status:410};
    if(prior)return prior.phoneHash===phoneHash && prior.batchId===batchId && prior.kg===kg && prior.lookupHash===lookupHash?{status:200,order:prior}:{status:409};
    if(req.body.expectedPriceVnd!==undefined && req.body.expectedPriceVnd!==rows[0].priceVnd)return {status:412};
    if(!rows[0].open)return {status:409};
    if(rows[0].closesAt && rows[0].closesAt.getTime()<=Date.now())return {status:410};
    if(rows[0].remainingKg<kg)return {status:409,available:rows[0].remainingKg};
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(12345,hashtext(${phoneHash}))`;
    const recent=await tx.preorder.count({where:{phoneHash,createdAt:{gte:new Date(Date.now()-3600000)}}});
    if(recent>=3||await tx.preorder.count({where:{phoneHash,status:'HOLD'}}))return {status:429};
    // Bound SMS dispatch even when a caller rotates phone numbers.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(12346,0)`;
    if(await tx.preorder.count({where:{phoneHash:{not:null},createdAt:{gte:new Date(Date.now()-600000)}}})>=60)return {status:429};
    const held=await tx.$executeRaw`UPDATE "Offer" SET "remainingKg"="remainingKg"-${kg} WHERE "batchId"=${batchId}
      AND ("closesAt" IS NULL OR clock_timestamp()<"closesAt")`;
    if(!held)return {status:410};
    const order=await tx.preorder.create({data:{id,batchId,kg,lookupHash,phoneHash,status:"HOLD",expiresAt:new Date(Date.now()+600000),sentAt:new Date(),sends:1,otpHash:mac(id.toLowerCase()+":"+otp),priceVnd:rows[0].priceVnd}});
    return {status:201,order};
  });
  if(result.status===201){try{await deliver(phone,otp);}catch{/* Hold remains accessible for resend or immediate cancellation. */}}
  const receipt=result.order?{status:result.order.status,expiresAt:result.order.expiresAt,id:result.order.id,kg:result.order.kg,batchId:result.order.batchId,priceVnd:result.order.priceVnd}:null;
  res.status(result.status).json(receipt??(result.available!==undefined?{error:'INSUFFICIENT_STOCK',remainingKg:result.available}:{error:'Không thể giữ số lượng yêu cầu'}));
});
app.listen(Number(process.env.API_PORT ?? 4000));
