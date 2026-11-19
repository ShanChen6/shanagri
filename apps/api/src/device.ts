import express from 'express';
import type {PrismaClient} from '@prisma/client';
import {advance,lockPump} from './queue.ts';
export function deviceRouter(db:PrismaClient){
  const router=express.Router();
  router.use((req,res,next)=>{
    if(!process.env.DEVICE_SIM_TOKEN || req.headers.authorization!=='Bearer '+process.env.DEVICE_SIM_TOKEN){res.sendStatus(401);return;}
    next();
  });
  const target={zoneId:'zone-cam',pumpId:'pump-demo',requiresValveAck:true};
  router.get('/command',async(_,res)=>{
    res.set('Cache-Control','no-store');
    const job=await db.irrigation.findFirst({where:{...target,status:'RUNNING'}});
    if(!job?.finishAt){res.json({action:'IDLE'});return;}
    res.json({jobId:job.id,action:Date.now()<job.finishAt.getTime()?'OPEN':'STOP',deadline:job.finishAt});
  });
  router.post('/commands/:id/closed',express.json({limit:'1kb'}),async(req,res)=>{
    const id=Number(req.params.id);
    if(!Number.isSafeInteger(id)||id<1||req.body?.valveState!=='CLOSED'){res.sendStatus(400);return;}
    const status=await db.$transaction(async tx=>{
      await lockPump(tx,target.pumpId);
      const job=await tx.irrigation.findFirst({where:{...target,id}});
      if(!job)return 404;
      if(job.status==='DONE' && job.closedAt)return 204;
      if(job.status!=='RUNNING'||!job.finishAt||Date.now()<job.finishAt.getTime())return 409;
      await tx.irrigation.update({where:{id},data:{status:'DONE',closedAt:new Date()}});
      await advance(tx,target.pumpId);
      return 204;
    });
    res.sendStatus(status);
  });
  router.post('/readings',express.json({limit:'2kb'}),async(req,res)=>{
    const token=process.env.DEVICE_SIM_TOKEN;
    if(!token || req.headers.authorization!=='Bearer '+token){res.sendStatus(401);return;}
    const {sampleId,observedAt,moisturePct}=req.body??{};
    const time=typeof observedAt==='string'?Date.parse(observedAt):NaN;
    if(typeof sampleId!=='string'||!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(sampleId)||
       !Number.isFinite(time)||!Number.isInteger(moisturePct)||moisturePct<0||moisturePct>100){res.sendStatus(400);return;}
    const zoneId='zone-cam';
    const same=(r:{observedAt:Date;moisturePct:number;zoneId:string})=>r.zoneId===zoneId&&r.observedAt.getTime()===time&&r.moisturePct===moisturePct;
    const existing=await db.virtualReading.findUnique({where:{sampleId}});
    if(existing){res.sendStatus(same(existing)?200:409);return;}
    const age=Date.now()-time;
    if(age>60000||age< -5000){res.sendStatus(422);return;}
    const result=await db.virtualReading.createMany({data:[{sampleId,zoneId,observedAt:new Date(time),moisturePct}],skipDuplicates:true});
    if(result.count){res.sendStatus(201);return;}
    const saved=await db.virtualReading.findUniqueOrThrow({where:{sampleId}});
    res.sendStatus(same(saved)?200:409);
  });
  return router;
}
