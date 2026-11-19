import express from 'express';
import type {Prisma,PrismaClient} from '@prisma/client';
import {createHash,randomUUID} from 'node:crypto';
import {scenario} from './day-one.ts';
const orderIdPattern=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
type FulfillmentAction='pack'|'deliver';

function applyFulfillment(db:Prisma.TransactionClient,where:Prisma.PreorderWhereInput,action:FulfillmentAction){
  const now=new Date();
  return action==='pack'
    ? db.preorder.updateMany({where:{...where,packedAt:null},data:{packedAt:now}})
    : db.preorder.updateMany({where:{...where,packedAt:{lte:now},deliveredAt:null},data:{deliveredAt:now}});
}

class FulfillmentConflict extends Error {}

function version(code:string,kg:number,orders:{id:string;kg:number;status:string;cancelRequested:boolean}[]){
  return createHash('sha256').update(JSON.stringify([code,kg,orders.map(o=>[o.id,o.kg,o.status,o.cancelRequested])])).digest('hex');
}
export function ownerOrders(db:PrismaClient){
  const router=express.Router();
  router.use((req,res,next)=>{
    res.set('Cache-Control','no-store');
    if(!process.env.DEMO_OWNER_TOKEN || req.headers.authorization!=='Bearer '+process.env.DEMO_OWNER_TOKEN){res.sendStatus(401);return;}
    next();
  });
  const scope={offer:{batch:{zone:{pump:{farmId:'demo'}}}}};
  const fulfillable:Prisma.PreorderWhereInput={
    status:'CONFIRMED',allocatedKg:{gt:0},
    offer:{...scope.offer,allocatedAt:{not:null}},
  };
  router.get('/',async(req,res)=>{
    const page=Number(req.query.page??1);
    if(!Number.isInteger(page)||page<1||page>100000){res.sendStatus(400);return;}
    const {batch, status, orderId, review, fulfillment}=req.query;
    const statuses=['HOLD','EXPIRED','PENDING','CONFIRMED','CANCELLED'];
    if((fulfillment!==undefined && (typeof fulfillment!=='string'||!['packing','delivery','delivered'].includes(fulfillment))) ||
       (status!==undefined && (typeof status!=='string'||!['all','active',...statuses].includes(status))) ||
       (orderId!==undefined && (typeof orderId!=='string'||!orderIdPattern.test(orderId)))){
      res.sendStatus(400);return;
    }
    const batchScope={...scope,...(typeof batch==='string'&&batch?{batchId:batch}:{})};
    const activeOnly=status==='active'||(status===undefined&&typeof batch==='string'&&!!batch&&review!=='pending');
    const filteredScope={
      ...batchScope,
      ...(activeOnly ? {status:{in:['PENDING','CONFIRMED','HOLD']}} :
        typeof status==='string'&&statuses.includes(status) ? {status} : {}),
      ...(typeof orderId==='string'?{id:orderId}:{}),
    };
    const packingScope={...batchScope,...fulfillable};
    const fulfillmentScopes={
      packing:{...packingScope,packedAt:null},
      delivery:{...packingScope,packedAt:{not:null},deliveredAt:null},
      delivered:{...packingScope,deliveredAt:{not:null}},
    } satisfies Record<string,Prisma.PreorderWhereInput>;
    const waitingScope={...filteredScope,cancelRequested:true};
    const baseWhere=review==='pending'?waitingScope:filteredScope;
    const where: Prisma.PreorderWhereInput=fulfillment==='packing'||fulfillment==='delivery'||fulfillment==='delivered'
      ? {AND:[baseWhere,fulfillmentScopes[fulfillment]]}
      : baseWhere;
    const [pendingCount,total,packing,delivery,delivered]=await Promise.all([
      db.preorder.count({where:waitingScope}),
      db.preorder.count({where}),
      db.preorder.count({where:fulfillmentScopes.packing}),
      db.preorder.count({where:fulfillmentScopes.delivery}),
      db.preorder.count({where:fulfillmentScopes.delivered}),
    ]);
    const currentPage=Math.min(page,Math.max(1,Math.ceil(total/25)));
    const rows=await db.preorder.findMany({
      where,orderBy:[{createdAt:'desc'},{id:'desc'}],skip:(currentPage-1)*25,take:25,
      select:{id:true,batchId:true,kg:true,priceVnd:true,status:true,cancelRequested:true,cancelDecision:true,createdAt:true,allocatedKg:true,packedAt:true,deliveredAt:true,offer:{select:{allocatedAt:true}}},
    });
    const offers=await db.offer.findMany({where:{batch:{zone:{pump:{farmId:'demo'}}}},orderBy:{batchId:'asc'},
      select:{actualKg:true,harvestDate:true,batchId:true,open:true,closesAt:true,totalKg:true,remainingKg:true,priceVnd:true}});
    const zones=await db.zone.findMany({where:{pump:{farmId:'demo'}},select:{id:true,name:true},orderBy:{name:'asc'}});
    const drafts=await db.batch.findMany({where:{published:false,zone:{pump:{farmId:'demo'}}},orderBy:{startDate:'desc'},
      select:{id:true,name:true,zoneId:true,startDate:true,expectedHarvestDate:true}});
    res.json({pendingCount,fulfillmentCounts:{packing,delivery,delivered},zones,drafts,offers:offers.map(o=>({...o,heldKg:o.totalKg-o.remainingKg})),orders:rows,page:currentPage,total,hasMore:currentPage*25<total});
  });
  router.get('/offers/:code/allocation-preview',async(req,res)=>{
    const offer=await db.offer.findFirst({where:{batchId:req.params.code,batch:{zone:{pump:{farmId:'demo'}}}},
      select:{allocatedAt:true,batchId:true,actualKg:true,orders:{where:{status:{in:['CONFIRMED','PENDING']}},
        orderBy:[{createdAt:'asc'},{id:'asc'}],select:{cancelRequested:true,allocatedKg:true,id:true,kg:true,createdAt:true,status:true,packedAt:true,deliveredAt:true}}}});
    if(!offer){res.sendStatus(404);return;}
    if(offer.actualKg===null){res.status(409).json({error:'Lô chưa chốt thu hoạch.'});return;}
    let remainingKg=offer.actualKg;
    const confirmed=offer.orders.filter(o=>o.status==='CONFIRMED').map(o=>{
      const proposedKg=o.allocatedKg??Math.min(o.kg,remainingKg);
      remainingKg-=proposedKg;
      return {...o,proposedKg,missingKg:o.kg-proposedKg};
    });
    const pending=offer.orders.filter(o=>o.status==='PENDING');
    const cancellationCount=confirmed.filter(o=>o.cancelRequested).length;
    const requestedKg=confirmed.reduce((total,o)=>total+o.kg,0);
    const assignedKg=offer.actualKg-remainingKg;
    res.json({
      allocatedAt:offer.allocatedAt,version:version(offer.batchId,offer.actualKg,offer.orders),batchId:offer.batchId,
      actualKg:offer.actualKg,remainingKg,confirmed,pending,
      summary:{requestedKg,assignedKg,missingKg:requestedKg-assignedKg},
      readiness:{canFinalize:!offer.allocatedAt&&confirmed.length>0&&!pending.length&&!cancellationCount,cancellationCount},
    });
  });
  router.post('/fulfillment/bulk',express.json({limit:'2kb'}),async(req,res)=>{
    const {ids,action}=req.body??{};
    if(!Array.isArray(ids)||ids.length<1||ids.length>25||
       ids.some(id=>typeof id!=='string'||!orderIdPattern.test(id))||
       (action!=='pack'&&action!=='deliver')){
      res.sendStatus(400);return;
    }
    const normalizedIds=ids.map(id=>id.toLowerCase());
    if(new Set(normalizedIds).size!==normalizedIds.length){res.sendStatus(400);return;}
    const where={...fulfillable,id:{in:normalizedIds}};
    try{
      const updated=await db.$transaction(async tx=>{
        const change=await applyFulfillment(tx,where,action);
        const completedWhere=action==='pack'?{packedAt:{not:null}}:{deliveredAt:{not:null}};
        const completed=await tx.preorder.count({where:{...where,...completedWhere}});
        if(completed!==normalizedIds.length)throw new FulfillmentConflict();
        return change.count;
      });
      res.json({selected:normalizedIds.length,updated});
    }catch(error){
      if(error instanceof FulfillmentConflict){res.sendStatus(409);return;}
      throw error;
    }
  });
  router.post('/offers/:code/fulfillment',express.json({limit:'1kb'}),async(req,res)=>{
    const code=req.params.code;
    const {id,action}=req.body??{};
    if(!/^[a-z0-9_-]{1,100}$/i.test(code) ||
       typeof id!=='string'||!orderIdPattern.test(id) ||
       (action!=='pack'&&action!=='deliver')){
      res.sendStatus(400);return;
    }
    const where={...fulfillable,id,batchId:code};
    const change=await applyFulfillment(db,where,action);
    if(change.count){res.sendStatus(204);return;}
    const order=await db.preorder.findFirst({
      where,select:{packedAt:true,deliveredAt:true},
    });
    const alreadyDone=action==='pack'?order?.packedAt:order?.deliveredAt;
    res.sendStatus(alreadyDone?204:409);
  });
  router.get('/offers/:code/packing-list',async(req,res)=>{
    const code=req.params.code;
    if(!/^[a-z0-9_-]{1,100}$/i.test(code)){res.sendStatus(400);return;}
    const offer=await db.offer.findFirst({
      where:{batchId:code,batch:{zone:{pump:{farmId:'demo'}}}},
      select:{
        allocatedAt:true,
        orders:{
          where:{status:'CONFIRMED',allocatedKg:{gt:0}},
          orderBy:[{createdAt:'asc'},{id:'asc'}],
          select:{id:true,kg:true,priceVnd:true,allocatedKg:true},
        },
      },
    });
    if(!offer){res.sendStatus(404);return;}
    if(!offer.allocatedAt){res.sendStatus(409);return;}

    const rows=['Mã lô,Mã đơn,Số kg đã đặt,Số kg cần soạn,Đơn giá (VND/kg),Giá trị giao (VND)'];
    const csvCode=code.startsWith('-')?"'"+code:code;
    for(const order of offer.orders){
      if(order.allocatedKg===null)continue;
      const deliveryValue=BigInt(order.allocatedKg)*BigInt(order.priceVnd);
      rows.push([csvCode,order.id,order.kg,order.allocatedKg,order.priceVnd,deliveryValue].join(','));
    }
    res.set('Content-Disposition',`attachment; filename="soan-hang-${code}.csv"`)
      .type('text/csv').send('\uFEFF'+rows.join('\r\n')+'\r\n');
  });
  router.post('/offers/:code/allocation',express.json({limit:'512kb'}),async(req,res)=>{
    const {items,version:seen}=req.body??{};
    if(!Array.isArray(items)||typeof seen!=='string'||items.some(x=>!x||typeof x.id!=='string'||!Number.isSafeInteger(x.kg)||x.kg<0)){
      res.sendStatus(400);return;
    }
    const code=req.params.code;
    const status=await db.$transaction(async tx=>{
      const [o]=await tx.$queryRaw<{actualKg:number|null;allocatedAt:Date|null}[]>`SELECT o."actualKg",o."allocatedAt" FROM "Offer" o
        JOIN "Batch" b ON b.id=o."batchId" JOIN "Zone" z ON z.id=b."zoneId" JOIN "Pump" p ON p.id=z."pumpId"
        WHERE b.id=${code} AND p."farmId"='demo' FOR UPDATE OF o`;
      if(!o)return 404;
      if(o.actualKg===null||o.allocatedAt)return 409;
      const orders=await tx.preorder.findMany({where:{batchId:code,status:{in:['CONFIRMED','PENDING']}},orderBy:[{createdAt:'asc'},{id:'asc'}]});
      if(version(code,o.actualKg,orders)!==seen||orders.some(x=>x.status==='PENDING'||x.cancelRequested))return 409;
      const byId=new Map<string,number>(items.map(x=>[x.id,x.kg]));
      if(!orders.length||items.length!==orders.length||byId.size!==orders.length)return 400;
      let available=o.actualKg;
      const fifo=orders.map(order=>{
        const kg=Math.min(available,order.kg);
        available-=kg;
        return {id:order.id,kg};
      });
      if(fifo.some(order=>byId.get(order.id)!==order.kg))return 400;
      for(const order of fifo)await tx.preorder.update({where:{id:order.id},data:{allocatedKg:order.kg}});
      await tx.offer.update({where:{batchId:code},data:{allocatedAt:new Date()}});
      return 204;
    });
    res.sendStatus(status);
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
  router.post('/drafts/:code/publish',express.json({limit:'1kb'}),async(req,res)=>{
    const {priceVnd,totalKg,closesAt:raw}=req.body??{};
    const closesAt=raw==null?null:new Date(typeof raw==='string'?raw:NaN);
    if(closesAt && (!Number.isFinite(+closesAt)||closesAt.toISOString()!==raw)){
      res.status(400).json({error:'Hạn chốt không hợp lệ.'});return;
    }
    if(![priceVnd,totalKg].every(n=>Number.isInteger(n)&&n>0&&n<=2147483647)){
      res.status(400).json({error:'Giá và hạn mức phải là số nguyên dương.'});return;
    }
    const batchId=req.params.code;
    const status=await db.$transaction(async tx=>{
      const [batch]=await tx.$queryRaw<{published:boolean}[]>`SELECT b.published FROM "Batch" b
        JOIN "Zone" z ON z.id=b."zoneId" JOIN "Pump" p ON p.id=z."pumpId"
        WHERE b.id=${batchId} AND p."farmId"='demo' FOR UPDATE OF b`;
      if(!batch)return 404;
      if(batch.published)return 200;
      if(closesAt && +closesAt<=Date.now())return 422;
      await tx.offer.create({data:{batchId,priceVnd,totalKg,closesAt,remainingKg:totalKg,open:true}});
      await tx.batch.update({where:{id:batchId},data:{published:true}});
      return 201;
    });
    res.status(status).json(status===422?{error:'Hạn chốt phải ở tương lai.'}:status===404?{error:'Không tìm thấy lô.'}:{code:batchId});
  });
  router.put('/offers/:code',express.json({limit:'1kb'}),async(req,res)=>{
    const {priceVnd,open,totalKg,actualKg,harvestDate}=req.body??{};
    if(actualKg!==undefined||harvestDate!==undefined){
      const day=new Date(typeof harvestDate==='string'?harvestDate:NaN);
      const today=new Date(Date.now()+7*3600000).toISOString().slice(0,10);
      if(!Number.isInteger(actualKg)||actualKg<0||actualKg>2147483647||!Number.isFinite(+day)||day.toISOString().slice(0,10)!==harvestDate||harvestDate>today){
        res.sendStatus(400);return;
      }
      const result=await db.$transaction(async tx=>{
        await tx.$queryRaw`SELECT "batchId" FROM "Offer" WHERE "batchId"=${req.params.code} FOR UPDATE`;
        return tx.offer.updateMany({where:{batchId:req.params.code,harvestDate:null,
        orders:{none:{status:'HOLD'}},batch:{startDate:{lte:day},zone:{pump:{farmId:'demo'}}}},data:{actualKg,harvestDate:day,open:false}});
      });
      res.sendStatus(result.count?204:409);return;
    }
    if(totalKg!==undefined){
      if(!Number.isInteger(totalKg)||totalKg<0||totalKg>2147483647||open!==undefined||priceVnd!==undefined){res.sendStatus(400);return;}
      const status=await db.$transaction(async tx=>{
        const [offer]=await tx.$queryRaw<{totalKg:number;remainingKg:number;harvestDate:Date|null}[]>`SELECT o."totalKg",o."remainingKg",o."harvestDate" FROM "Offer" o
          JOIN "Batch" b ON b.id=o."batchId" JOIN "Zone" z ON z.id=b."zoneId" JOIN "Pump" p ON p.id=z."pumpId"
          WHERE o."batchId"=${req.params.code} AND p."farmId"='demo' FOR UPDATE OF o`;
        if(!offer)return 404;
        if(offer.harvestDate)return 409;
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
    const result=await db.offer.updateMany({where:{batchId:req.params.code,harvestDate:null,batch:{zone:{pump:{farmId:'demo'}}}},data});
    res.sendStatus(result.count?204:404);
  });
  router.post('/:id/:action',async(req,res)=>{
    const {id,action}=req.params;
    if(!/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(id)||!['confirm','cancel','approve-cancel','decline-cancel'].includes(action)){res.sendStatus(400);return;}
    const status=action==='confirm'?'CONFIRMED':'CANCELLED';
    const result=await db.$transaction(async tx=>{
      // Serialize retries and competing owner decisions for this order.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id.toLowerCase()}))`;
      const o=await tx.preorder.findFirst({where:{id,...scope}});
      if(!o)return 404;
      if(action==='approve-cancel'||action==='decline-cancel'){
        const decision=action==='approve-cancel'?'APPROVED':'DECLINED';
        if(o.cancelDecision)return o.cancelDecision===decision?204:409;
        if(!o.cancelRequested||o.status!=='CONFIRMED')return 409;
        const [offer]=await tx.$queryRaw<{allocatedAt:Date|null}[]>`SELECT "allocatedAt" FROM "Offer" WHERE "batchId"=${o.batchId} FOR UPDATE`;
        if(offer.allocatedAt)return 409;
        await tx.preorder.update({where:{id},data:{cancelDecision:decision,cancelRequested:false,status:decision==='APPROVED'?'CANCELLED':'CONFIRMED'}});
        if(decision==='APPROVED')await tx.offer.update({where:{batchId:o.batchId},data:{remainingKg:{increment:o.kg}}});
        return 204;
      }
      if(action==='cancel'&&o.cancelRequested)return 409;
      if(o.status===status)return 204;
      const [offer]=await tx.$queryRaw<{allocatedAt:Date|null}[]>`SELECT "allocatedAt" FROM "Offer" WHERE "batchId"=${o.batchId} FOR UPDATE`;
      if(offer.allocatedAt||['CANCELLED','EXPIRED'].includes(o.status)||(o.status==='HOLD'&&status==='CONFIRMED'))return 409;
      await tx.preorder.update({where:{id},data:{status,cancelRequested:false,otpHash:null}});
      if(status==='CANCELLED')await tx.offer.update({where:{batchId:o.batchId},data:{remainingKg:{increment:o.kg}}});
      return 204;
    });
    res.sendStatus(result);
  });
  return router;
}
