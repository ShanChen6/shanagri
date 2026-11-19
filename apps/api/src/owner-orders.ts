import express from 'express';
import type {PrismaClient} from '@prisma/client';
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
    res.json({orders:rows.slice(0,25),hasMore:rows.length>25});
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
