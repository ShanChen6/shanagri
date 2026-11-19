import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
// Run against a freshly seeded, disposable LOCAL instance only.
const base='http://127.0.0.1:'+Number(process.env.API_PORT??4000)+'/api/';
assert.ok(process.env.DEMO_OWNER_TOKEN);
const owner='farms/demo/owner/orders',auth='Bearer '+process.env.DEMO_OWNER_TOKEN;
async function call(path,method='GET',body,authorization){
  return fetch(base+path,{method,headers:{'Content-Type':'application/json',...(authorization?{authorization}:{})},body:JSON.stringify(body)});
}
const admin=(path='',method='GET',body)=>call(owner+path,method,body,auth);
const read=async r=>{assert.equal(r.status,200);return r.json()};
assert.equal((await call(owner)).status,401);
assert.equal((await call('farms/demo/simulation/day-one','POST')).status,200);
const farm=await read(await call('farms/demo/zones'));
assert.deepEqual(farm.map(z=>[z.simulatedDays[0].moisturePct,z.simulatedDays[0].needsWater]),[[45,true],[45,false]]);
const trace=async()=>read(await call('public/batches/CAM-2026-01'));
let logs=[];for(let i=0;i<30&&!logs.length;i++){logs=(await trace()).irrigations;if(!logs.length)await new Promise(r=>setTimeout(r,500));}
assert.equal(logs[0]?.estimatedLiters,1);
const draft=await admin('/drafts','POST',{name:'Lô nghiệm thu API',zoneId:'zone-cam',startDate:'2026-03-01',expectedHarvestDate:'2026-03-31'});assert.equal(draft.status,201);
const {id:code}=await draft.json(),lot='public/batches/'+code,offer='/offers/'+code;
assert.equal((await call(lot)).status,404);
assert.equal((await admin('/drafts/'+code+'/publish','POST',{priceVnd:37000,totalKg:100})).status,201);
const market=async()=>read(await call('public/market'));
assert.ok((await market()).some(x=>x.code===code));
const orders=[];for(const kg of [30,25,25]){
 const o={id:randomUUID(),kg,lookupToken:randomBytes(32).toString('hex'),expectedPriceVnd:37000};
 assert.equal((await call(lot+'/preorders','POST',o)).status,201);orders.push(o);
 assert.equal((await admin('/'+o.id+'/confirm','POST')).status,204);
}
assert.equal((await admin(offer,'PUT',{actualKg:65,harvestDate:'2026-03-31'})).status,204);
assert.ok(!(await market()).some(x=>x.code===code));
assert.equal((await call(lot+'/preorders','POST',{id:randomUUID(),kg:1})).status,409);
const plan=await read(await admin(offer+'/allocation-preview'));
assert.deepEqual(plan.confirmed.map(x=>x.proposedKg),[30,25,10]);
const invalidSplit={version:plan.version,items:orders.map((o,i)=>({id:o.id,kg:[25,20,20][i]}))};
assert.equal((await admin(offer+'/allocation','POST',invalidSplit)).status,400);
const assigned=[30,25,10],body={version:plan.version,items:orders.map((o,i)=>({id:o.id,kg:assigned[i]}))};
const finish=()=>admin(offer+'/allocation','POST',body);
assert.deepEqual((await Promise.all([finish(),finish()])).map(r=>r.status).sort(),[204,409]);
for(const [i,o] of orders.entries()){
 const receipt=await read(await call('public/order-lookup','GET',undefined,'Bearer '+o.lookupToken));
 assert.deepEqual([receipt.id,receipt.kg,receipt.allocatedKg,receipt.totalVnd,receipt.status],[o.id,o.kg,assigned[i],o.kg*37000,'CONFIRMED']);
}
console.log('PASS: irrigation trace, publish, 3 reservations, harvest, one finalization and 3 private receipts');

// Two buyers saw the same 35 kg. No partial reservation on stale quantity.
const stockCode='CAM-2026-02',stockLot='public/batches/'+stockCode;
assert.equal((await admin('/offers/'+stockCode,'PUT',{totalKg:35})).status,204);
const request=kg=>({id:randomUUID(),kg,lookupToken:randomBytes(32).toString('hex')});
const buy=o=>call(stockLot+'/preorders','POST',o),a=request(25),second=request(25);
assert.equal((await buy(a)).status,201);
const refused=await buy(second);assert.equal(refused.status,409);
assert.deepEqual(await refused.json(),{error:'INSUFFICIENT_STOCK',remainingKg:10});
assert.equal((await read(await call(stockLot))).offer.remainingKg,10);
assert.equal((await call('public/order-lookup','GET',undefined,'Bearer '+second.lookupToken)).status,404);
assert.equal((await market()).find(x=>x.code===stockCode).remainingKg,10);
assert.equal((await buy({...second,kg:10})).status,201);
assert.equal((await read(await call(stockLot))).offer.remainingKg,0);
assert.ok(!(await market()).some(x=>x.code===stockCode));
console.log('PASS: stale 25 kg request rejected; buyer explicitly selected the remaining 10 kg');
// Leave the shared acceptance stack without pending orders for the browser suite.
for(const o of [a,second])assert.equal((await admin('/'+o.id+'/cancel','POST')).status,204);
