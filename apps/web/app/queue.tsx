'use client';
import { Card, StatusMessage } from '../components/ui';
import {useEffect,useState} from 'react';
type Job={id:number;status:string;requiresValveAck:boolean;finishAt:string|null;zone:{name:string};pump:{name:string}};
export default function Queue(){
  const [jobs,setJobs]=useState<Job[]|null>(null),[failed,setFailed]=useState(false);
  useEffect(()=>{
    const abort=new AbortController(); let timer:ReturnType<typeof setTimeout>;
    async function poll(){
      try{
        const r=await fetch('/api/queue',{cache:'no-store',signal:abort.signal});
        if(!r.ok) throw Error();
        setJobs(await r.json());setFailed(false);
      }catch{if(!abort.signal.aborted)setFailed(true);}
      if(!abort.signal.aborted) timer=setTimeout(poll,2000);
    }
    void poll();return ()=>{abort.abort();clearTimeout(timer);};
  },[]);
  return <Card as="section"><h2>Hàng đợi tưới</h2>{failed?<StatusMessage>Không tải được hàng đợi.</StatusMessage>:jobs===null?<StatusMessage>Đang tải…</StatusMessage>:jobs.length?
    <ol>{jobs.map(j=><li key={j.id}>{j.pump.name} · {j.zone.name}: {j.status==='RUNNING'?(j.requiresValveAck?(j.finishAt && Date.parse(j.finishAt)<=Date.now()?'Chờ xác nhận đóng van':'Đã cấp lượt cho van ảo'):'Đang tưới'):'Đang chờ'}</li>)}</ol>:<StatusMessage>Không có lượt tưới đang chờ hoặc đang chạy.</StatusMessage>}</Card>;
}
