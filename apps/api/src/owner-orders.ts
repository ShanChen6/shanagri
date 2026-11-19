import express from 'express';
import type {PrismaClient} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {scenario} from './day-one.ts';
export function ownerOrders(db:PrismaClient){
  const router=express.Router();
  router.use((req,res,next)=>{
    res.set('Cache-Control','no-store');
    if(!process.env.DEMO_OWNER_TOKEN || req.headers.authorization!=='Bearer '+process.env.DEMO_OWNER_TOKEN){res.sendStatus(401);return;}
    next();
  });
  const scope={offer:{batch:{zone:{pump:{farmId:'demo'}}}}};
  router.get('/',async(req,res)=>{
    const page=Number(req.query.page??1);
    if(!Number.isInteger(page)||page<1||page>100000){res.sendStatus(400);return;}
    const rows=await db.preorder.findMany({where:scope,orderBy:[{createdAt:'desc'},{id:'desc'}],skip:(page-1)*25,take:26});
    const offers=await db.offer.findMany({where:{batch:{zone:{pump:{farmId:'demo'}}}},orderBy:{batchId:'asc'},
      select:{batchId:true,open:true,totalKg:true,remainingKg:true,priceVnd:true}});
    const zones=await db.zone.findMany({where:{pump:{farmId:'demo'}},select:{id:true,name:true},orderBy:{name:'asc'}});
    const drafts=await db.batch.findMany({where:{published:false,zone:{pump:{farmId:'demo'}}},orderBy:{startDate:'desc'},
      select:{id:true,name:true,zoneId:true,startDate:true,expectedHarvestDate:true}});
    res.json({zones,drafts,offers:offers.map(o=>({...o,heldKg:o.totalKg-o.remainingKg})),orders:rows.slice(0,25),hasMore:rows.length>25});
  });
  router.post('/drafts',express.json({limit:'4kb'}),async(req,res)=>{
    const {name,zoneId,startDate,expectedHarvestDate}=req.body??{};
    function valid(s:unknown):s is string {
      if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s)||s.startsWith('0000'))return false;
      const d=new Date(s);return Number.isFinite(+d)&&d.toISOString().slice(0,10)===s;
    }
    if(typeof name!=='string'||!name.trim()||name.trim().length>120||typeof zoneId!=='string'||
       !valid(startDate)||!valid(expectedHarvestDate)||expectedHarvestDate<startDate){
      res.status(400).json({error:'Kiểm tra tên lô và khoảng ngày canh tác.'});return;
    }
    const result=await db.$transaction(async tx=>{
      const zone=await tx.$queryRaw<{id:string}[]>`SELECT z.id FROM "Zone" z JOIN "Pump" p ON p.id=z."pumpId"
        WHERE z.id=${zoneId} AND p."farmId"='demo' FOR UPDATE OF z`;
      if(!zone.length)return {status:404,body:{error:'Không tìm thấy vùng trồng.'}};
      const start=new Date(startDate),end=new Date(expectedHarvestDate);
      const clash=await tx.batch.findFirst({where:{zoneId,scenario,startDate:{lte:end},expectedHarvestDate:{gte:start}}});
      if(clash)return {status:409,body:{error:'Trùng lô '+clash.id+' ('+clash.startDate.toISOString().slice(0,10)+' – '+clash.expectedHarvestDate.toISOString().slice(0,10)+').'}};
      const batch=await tx.batch.create({data:{id:'LO-'+randomUUID(),name:name.trim(),zoneId,scenario,startDate:start,expectedHarvestDate:end,published:false}});
      return {status:201,body:{id:batch.id}};
    });
    res.status(result.status).json(result.body);
  });
  router.put('/offers/:code',express.json({limit:'1kb'}),async(req,res)=>{
    const {priceVnd,open,totalKg}=req.body??{};
    if(totalKg!==undefined){
      if(!Number.isInteger(totalKg)||totalKg<0||totalKg>2147483647||open!==undefined||priceVnd!==undefined){res.sendStatus(400);return;}
      const status=await db.$transaction(async tx=>{
        const [offer]=await tx.$queryRaw<{totalKg:number;remainingKg:number}[]>`SELECT o."totalKg",o."remainingKg" FROM "Offer" o
          JOIN "Batch" b ON b.id=o."batchId" JOIN "Zone" z ON z.id=b."zoneId" JOIN "Pump" p ON p.id=z."pumpId"
          WHERE o."batchId"=${req.params.code} AND p."farmId"='demo' FOR UPDATE OF o`;
        if(!offer)return 404;
        const held=offer.totalKg-offer.remainingKg;
        if(totalKg<held)return 409;
        await tx.offer.update({where:{batchId:req.params.code},data:{totalKg,remainingKg:totalKg-held}});
        return 204;
      });
      res.sendStatus(status);return;
    }
    const data=typeof open==='boolean' && priceVnd===undefined?{open}:
      open===undefined && Number.isInteger(priceVnd) && priceVnd>0 && priceVnd<=2147483647?{priceVnd}:null;
    if(!data){res.sendStatus(400);return;}
    const result=await db.offer.updateMany({where:{batchId:req.params.code,batch:{zone:{pump:{farmId:'demo'}}}},data});
    res.sendStatus(result.count?204:404);
  });
  router.post('/:id/:action',async(req,res)=>{
    const {id,action}=req.params;
    if(!/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(id)||!['confirm','cancel'].includes(action)){res.sendStatus(400);return;}
    const status=action==='confirm'?'CONFIRMED':'CANCELLED';
    const result=await db.$transaction(async tx=>{
      // Serialize retries and competing owner decisions for this order.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id.toLowerCase()}))`;
      const o=await tx.preorder.findFirst({where:{id,...scope}});
      if(!o)return 404;
      if(o.status===status)return 204;
      if(o.status==='CANCELLED')return 409;
      await tx.preorder.update({where:{id},data:{status}});
      if(status==='CANCELLED')await tx.offer.update({where:{batchId:o.batchId},data:{remainingKg:{increment:o.kg}}});
      return 204;
    });
    res.sendStatus(result);
  });
  return router;
}
