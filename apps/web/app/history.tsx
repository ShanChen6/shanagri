'use client';
import { formatDateTime, formatLiters } from '../lib/format';
import { Card, DataTable, SelectField, StatusMessage } from '../components/ui';
import {useEffect,useState} from 'react';
type Entry={id:number;source:string;finishAt:string;closedAt:string|null;estimatedLiters:number|null;zone:{name:string}};
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
  return <Card as="section"><h2>Nhật ký tưới mô phỏng</h2><SelectField label="Vùng trồng" value={zone} onChange={e=>{setRows(null);setZone(e.target.value);}}>
    <option value="">Tất cả</option>{zones.map(z=><option key={z.id} value={z.id}>{z.name}</option>)}</SelectField>
    {failed?<StatusMessage>Không tải được nhật ký.</StatusMessage>:!rows?<StatusMessage>Đang tải…</StatusMessage>:!rows.length?<StatusMessage>Chưa có lượt tưới hoàn tất.</StatusMessage>:
    <DataTable label="Nhật ký tưới mô phỏng"><caption>50 lượt gần nhất · thời gian thực</caption><thead><tr><th>Kết thúc (giờ Việt Nam)</th><th>Vùng</th><th>Yêu cầu</th><th>Nước ước tính</th></tr></thead>
    <tbody>{rows.map(r=><tr key={r.id}><td><time dateTime={r.closedAt??r.finishAt}>{formatDateTime(r.closedAt??r.finishAt)}</time></td><td>{r.zone.name}</td><td>{r.source==='AUTO'?'Tự động':'Thủ công'}</td>
    <td>{r.estimatedLiters===null?'Chưa có dữ liệu':formatLiters(r.estimatedLiters)}</td></tr>)}</tbody></DataTable>}</Card>;
}
