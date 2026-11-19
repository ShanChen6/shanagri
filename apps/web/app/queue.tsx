'use client';
import {useEffect,useState} from 'react';
type Job={id:number;status:string;zone:{name:string};pump:{name:string}};
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
  return <section><h2>Hàng đợi tưới</h2>{failed?<p>Không tải được hàng đợi.</p>:jobs===null?<p>Đang tải…</p>:jobs.length?
    <ol>{jobs.map(j=><li key={j.id}>{j.pump.name} · {j.zone.name}: {j.status==='RUNNING'?'Đang tưới':'Đang chờ'}</li>)}</ol>:<p>Không có lượt tưới đang chờ hoặc đang chạy.</p>}</section>;
}
