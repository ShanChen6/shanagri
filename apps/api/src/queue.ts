import type { Prisma } from '@prisma/client';
type Tx = Prisma.TransactionClient;
export async function lockPump(tx:Tx,id:string) {
  await tx.$queryRaw`SELECT id FROM "Pump" WHERE id=${id} FOR UPDATE`;
}
// Caller holds the pump row lock. PostgreSQL time survives process restarts.
export async function advance(tx:Tx,id:string) {
  await tx.$executeRaw`UPDATE "Irrigation" SET status='DONE',
    "estimatedMl"=round(extract(epoch from ("finishAt"-"startedAt"))*"flowMlPerSecond")::bigint WHERE "pumpId"=${id} AND NOT "requiresValveAck" AND status='RUNNING' AND "finishAt"<=clock_timestamp()`;
  await tx.$executeRaw`UPDATE "Irrigation" SET status='RUNNING',"startedAt"=statement_timestamp(),
    "flowMlPerSecond"=(SELECT "flowMlPerSecond" FROM "Pump" WHERE id=${id}),"finishAt"=statement_timestamp()+interval '10 seconds'
    WHERE id=(SELECT id FROM "Irrigation" WHERE "pumpId"=${id} AND status='PENDING' ORDER BY id LIMIT 1)
    AND NOT EXISTS(SELECT 1 FROM "Irrigation" WHERE "pumpId"=${id} AND status='RUNNING')`;
}
export async function enqueue(tx:Tx,z:{id:string;pumpId:string},source:string) {
  await lockPump(tx,z.pumpId);
  await advance(tx,z.pumpId);
  const where={zoneId:z.id,status:{in:['PENDING','RUNNING']}};
  const open=await tx.irrigation.findFirst({where});
  if(!open) await tx.irrigation.create({data:{zoneId:z.id,pumpId:z.pumpId,source,requiresValveAck:z.id==='zone-cam' && process.env.VIRTUAL_VALVE_ENABLED==='true'}});
  await advance(tx,z.pumpId);
  return tx.irrigation.findFirstOrThrow({where});
}
