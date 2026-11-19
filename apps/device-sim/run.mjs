import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
if(!process.env.DEVICE_SIM_TOKEN) throw Error('Thiếu DEVICE_SIM_TOKEN trong .env');
const base=process.env.API_BASE_URL??('http://localhost:'+(process.env.API_PORT??4000));
for(let n=0;;n++){
  const body=JSON.stringify({sampleId:randomUUID(),observedAt:new Date().toISOString(),moisturePct:50-(n%12)});
  for(let attempt=0;attempt<3;attempt++){
    try {
      const r=await fetch(base+'/api/devices/virtual-cam/readings',{method:'POST',headers:{
        'Content-Type':'application/json',Authorization:'Bearer '+process.env.DEVICE_SIM_TOKEN},body,signal:AbortSignal.timeout(3000)});
      console.log('Thiết bị ảo · HTTP',r.status);
      if(r.status<500)break;
    }catch{console.warn('Chưa kết nối được API');}
    await delay(1000);
  }
  if(process.argv.includes('--once'))break;
  await delay(5000);
}
