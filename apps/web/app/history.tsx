'use client';
import {useEffect,useState} from 'react';
type Entry={id:number;source:string;finishAt:string;estimatedLiters:number|null;zone:{name:string}};
export default function History({zones}:{zones:{id:string;name:string}[]}){
  const [zone,setZone]=useState(''),[rows,setRows]=useState<Entry[]|null>(null),[failed,setFailed]=useState(false);
  useEffect(()=>{
    const abort=new AbortController(); let timer:ReturnType<typeof setTimeout>;
    async function poll(){
      try{
        const r=await fetch('/api/irrigation-history?zoneId='+encodeURIComponent(zone),{signal:abort.signal,cache:'no-store'});
        if(!r.ok)throw Error();
        const data=await r.json();
        if(!abort.signal.aborted){setRows(data);setFailed(false);}
      }catch{if(!abort.signal.aborted)setFailed(true);}
      if(!abort.signal.aborted)timer=setTimeout(poll,3000);
    }
    void poll();return ()=>{abort.abort();clearTimeout(timer);};
  },[zone]);
  return <section><h2>Nhật ký tưới mô phỏng</h2><label>Vùng trồng <select value={zone} onChange={e=>{setRows(null);setZone(e.target.value);}}>
    <option value="">Tất cả</option>{zones.map(z=><option key={z.id} value={z.id}>{z.name}</option>)}</select></label>
    {failed?<p>Không tải được nhật ký.</p>:!rows?<p>Đang tải…</p>:!rows.length?<p>Chưa có lượt tưới hoàn tất.</p>:
    <table><caption>50 lượt gần nhất · thời gian thực</caption><thead><tr><th>Kết thúc</th><th>Vùng</th><th>Yêu cầu</th><th>Nước ước tính</th></tr></thead>
    <tbody>{rows.map(r=><tr key={r.id}><td>{new Date(r.finishAt).toLocaleString('vi-VN')}</td><td>{r.zone.name}</td><td>{r.source==='AUTO'?'Tự động':'Thủ công'}</td>
    <td>{r.estimatedLiters===null?'Chưa có dữ liệu':r.estimatedLiters.toLocaleString('vi-VN')+' L'}</td></tr>)}</tbody></table>}</section>;
}
