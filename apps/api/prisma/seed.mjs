import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
try {
  await db.$transaction(async tx => {
    const put = (model, data) => model.upsert({where:{id:data.id}, create:data, update:{}});
    await put(tx.farm, {id:'demo', name:'Trang trại Shanagri'});
    await put(tx.pump, {id:'pump-demo', farmId:'demo', name:'Bơm chính'});
    for (const [id,name,dryBelowPct] of [['cam','Cam Sành',50],['xuong-rong','Xương Rồng',25]]) {
      await put(tx.plantProfile,{id,name,dryBelowPct});
      await put(tx.zone,{id:'zone-'+id,name:'Vùng '+name,pumpId:'pump-demo',plantProfileId:id});
    }
  });
} finally { await db.$disconnect(); }
