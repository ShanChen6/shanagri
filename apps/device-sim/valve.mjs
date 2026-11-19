// One process represents one virtual actuator. Its initial valve state is closed.
import {setTimeout as wait} from 'node:timers/promises';
const base=(process.env.API_BASE_URL??('http://localhost:'+(process.env.API_PORT??4000)))+'/api/devices/virtual-cam';
if(!process.env.DEVICE_SIM_TOKEN)throw Error('Thiếu DEVICE_SIM_TOKEN');
const headers={Authorization:'Bearer '+process.env.DEVICE_SIM_TOKEN,'Content-Type':'application/json'};
let open=false,timer;
function close(){open=false;clearTimeout(timer);}
for(;;){
  try{
    const r=await fetch(base+'/command',{headers,signal:AbortSignal.timeout(2500)});
    if(!r.ok)throw Error('HTTP '+r.status);
    const cmd=await r.json();
    const remaining=Date.parse(cmd.deadline)-Date.now();
    if(cmd.action==='OPEN' && remaining>0){
      open=true; clearTimeout(timer);timer=setTimeout(close,Math.min(remaining,10000));
    }else{
      close();
      if(cmd.action==='STOP' && !open){
        const ack=await fetch(base+'/commands/'+cmd.jobId+'/closed',{method:'POST',headers,body:JSON.stringify({valveState:'CLOSED'}),signal:AbortSignal.timeout(2500)});
        if(!ack.ok)throw Error('ACK HTTP '+ack.status);
        console.log('Đã xác nhận đóng van:',cmd.jobId);
      }
    }
  }catch(e){close();console.error(e.message);}
  await wait(500);
}
