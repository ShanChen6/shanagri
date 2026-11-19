import {createHash,createHmac,randomInt} from 'node:crypto';
import type {Prisma,PrismaClient} from '@prisma/client';
import express from 'express';
type Tx=Prisma.TransactionClient;
const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
export const mac=(s:string)=>createHmac('sha256',process.env.OTP_SECRET!).update(s).digest('hex');
export function phoneNumber(value:unknown){
 if(typeof value!=='string')return '';
 const n=value.replace(/[ ()-]/g,'').replace(/^0/,'+84');return /^\+84[35789]\d{8}$/.test(n)?n:'';
}
export const pin=()=>String(randomInt(100000,1000000));
export function ready(){
 try{const u=new URL(process.env.SMS_WEBHOOK_URL??'');return !!process.env.SMS_WEBHOOK_TOKEN && (process.env.OTP_SECRET?.length??0)>=32 &&
 (u.protocol==='https:'||(u.protocol==='http:'&&u.hostname==='127.0.0.1'));}catch{return false;}
}
export async function deliver(phone:string,code:string){
 const r=await fetch(process.env.SMS_WEBHOOK_URL!,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',authorization:'Bearer '+process.env.SMS_WEBHOOK_TOKEN},
 body:JSON.stringify({to:phone,message:'Shanagri: ma xac minh '+code+'. Khong chia se ma nay.'}),signal:AbortSignal.timeout(5000)});
 if(!r.ok)throw Error('SMS unavailable');
}
async function lock(tx:Tx,id:string){await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id.toLowerCase()}))`;}
export async function release(tx:Tx,o:{id:string;batchId:string;kg:number},status:'EXPIRED'|'CANCELLED'){
 await tx.preorder.update({where:{id:o.id},data:{status,otpHash:null}});
 await tx.offer.update({where:{batchId:o.batchId},data:{remainingKg:{increment:o.kg}}});
}
export async function sweep(db:PrismaClient){
 const due=await db.preorder.findMany({where:{status:'HOLD',expiresAt:{lte:new Date()}},select:{id:true},orderBy:{expiresAt:'asc'},take:100});
 for(const {id} of due)await db.$transaction(async tx=>{
   await lock(tx,id);const o=await tx.preorder.findUnique({where:{id}});
   if(o?.status==='HOLD'&&o.expiresAt&&+o.expiresAt<=Date.now())await release(tx,o,'EXPIRED');
 });
}
export function holdRoutes(db:PrismaClient){
 const router=express.Router();
 router.post('/:action',express.json({limit:'2kb'}),async(req,res)=>{
   const action=req.params.action,token=req.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
   if(!token||!['verify','resend','cancel'].includes(action)){res.sendStatus(404);return;}
   const lookupHash=digest(token),ref=await db.preorder.findUnique({where:{lookupHash},select:{id:true}});
   if(!ref){res.sendStatus(404);return;}
   const phone=phoneNumber(req.body?.phone),code=pin();
   const status=await db.$transaction(async tx=>{
     await lock(tx,ref.id);
     const o=await tx.preorder.findUniqueOrThrow({where:{id:ref.id}});
     if(o.status==='HOLD'&&o.expiresAt&&+o.expiresAt<=Date.now()){await release(tx,o,'EXPIRED');return 410;}
     if(action==='cancel'){
       if(o.status==='CANCELLED')return 204;
       if(o.status==='HOLD'||o.status==='PENDING'){await release(tx,o,'CANCELLED');return 204;}
       if(o.status==='CONFIRMED'&&o.allocatedKg===null&&!o.cancelDecision){
         const [offer]=await tx.$queryRaw<{allocatedAt:Date|null}[]>`SELECT "allocatedAt" FROM "Offer" WHERE "batchId"=${o.batchId} FOR UPDATE`;
         if(offer.allocatedAt)return 409;
         await tx.preorder.update({where:{id:o.id},data:{cancelRequested:true}});return 202;}
       return 409;
     }
     if(o.status!=='HOLD')return action==='verify'&&['PENDING','CONFIRMED'].includes(o.status)?204:409;
     if(!ready())return 503;
     if(action==='resend'){
       if(!phone||mac('phone:'+phone)!==o.phoneHash)return 400;
       if(o.sends>=3||Date.now()-Number(o.sentAt)<60000)return 429;
       await tx.preorder.update({where:{id:o.id},data:{otpHash:mac(o.id+':'+code),sentAt:new Date(),sends:{increment:1}}});return 201;
     }
     if(o.attempts>=5)return 429;
     if(typeof req.body?.code!=='string'||!/^\d{6}$/.test(req.body.code)||mac(o.id+':'+req.body.code)!==o.otpHash){
       await tx.preorder.update({where:{id:o.id},data:{attempts:{increment:1}}});return 400;
     }
     await tx.preorder.update({where:{id:o.id},data:{status:'PENDING',otpHash:null}});return 204;
   });
   if(status===201){try{await deliver(phone,code);}catch{res.sendStatus(503);return;}}
   res.sendStatus(status);
 });
 return router;
}
