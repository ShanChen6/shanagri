'use client';
import {useState} from 'react';
type Order={id:string;kg:number;createdAt:string};
type Plan={version:string;allocatedAt:string|null;actualKg:number;remainingKg:number;confirmed:(Order&{proposedKg:number;missingKg:number})[];pending:Order[]};
export default function AllocationPreview({code,ownerKey}:{code:string;ownerKey:string}){
 const [plan,set]=useState<Plan|null>(null),[busy,B]=useState(false),[error,E]=useState('');
 const [values,V]=useState<Record<string,string>>({});
 const sum=plan?.confirmed.reduce((n,o)=>n+Number(values[o.id]),0)??0;
 const invalid=!plan||!plan.confirmed.length||!!plan.pending.length||sum>plan.actualKg||plan.confirmed.some(o=>{
   const raw=values[o.id],n=Number(raw);return !raw||!Number.isInteger(n)||n<0||n>o.kg;
 });
 async function finalize(){
   if(!plan||invalid||!confirm('Chốt phân bổ '+sum+' kg? Khách sẽ thấy kết quả trên liên kết tra cứu.'))return;
   B(true);E('');
   try{
     const r=await fetch('/api/allocation-preview?code='+encodeURIComponent(code),{method:'POST',headers:{authorization:'Bearer '+ownerKey,'Content-Type':'application/json'},
       body:JSON.stringify({version:plan.version,items:plan.confirmed.map(o=>({id:o.id,kg:Number(values[o.id])}))})});
     if(r.status===409){set(null);E('Phương án đã thay đổi hoặc đã chốt. Hãy mở lại bản xem trước.');return;}
     if(!r.ok)throw Error();
     await load();
   }catch{E('Chưa xác nhận được kết quả. Hãy cập nhật bản xem trước.');}finally{B(false);}
 }
 async function load(){
   B(true);E('');
   try{
     const r=await fetch('/api/allocation-preview?code='+encodeURIComponent(code),{headers:{authorization:'Bearer '+ownerKey},cache:'no-store'});
     if(!r.ok)throw Error();
     const next:Plan=await r.json();V(Object.fromEntries(next.confirmed.map(o=>[o.id,String(o.proposedKg)])));set(next);
   }catch{set(null);E('Không tải được phương án. Vui lòng thử lại.');}finally{B(false);}
 }
 return <section><button disabled={busy} onClick={load}>{busy?'Đang tải…':plan?'Cập nhật bản xem trước':'Xem trước phân bổ'}</button>
 <span role="status">{error}</span>{plan&&<><h3>{plan.allocatedAt?'Phân bổ đã chốt':'Đề xuất phân bổ'} · {code}</h3>
 <p>Thực thu {plan.actualKg} kg · Đề xuất giao {sum} kg · Chưa phân bổ {plan.actualKg-sum} kg.</p>
 <p>{plan.allocatedAt?'Khách có thể tra cứu kết quả.':'Có thể chỉnh số kg trước khi chốt. Hãy xác nhận hoặc hủy hết đơn đang chờ.'}</p>
 {plan.confirmed.length?<table><thead><tr><th>Mã đơn</th><th>Thời điểm đặt (giờ Việt Nam)</th><th>Đã đặt</th><th>Đề xuất giao</th><th>Thiếu</th></tr></thead>
 <tbody>{plan.confirmed.map(o=><tr key={o.id}><td>{o.id}</td><td>{new Date(o.createdAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}</td><td>{o.kg} kg</td><td>{plan.allocatedAt?o.proposedKg:<input aria-label={'Số kg phân bổ '+o.id} type="number" min={0} max={o.kg} step={1} disabled={busy} value={values[o.id]??''} onChange={e=>V({...values,[o.id]:e.target.value})}/>} kg</td><td>{o.kg-Number(values[o.id])} kg</td></tr>)}</tbody></table>:<p>Chưa có đơn đã xác nhận.</p>}
 <h4>Chờ xác nhận · chưa phân bổ</h4>{plan.pending.length?<ul>{plan.pending.map(o=><li key={o.id}>{o.id} · Đặt {o.kg} kg</li>)}</ul>:<p>Không có đơn chờ xác nhận.</p>}
 {!plan.allocatedAt&&<button disabled={busy||invalid} onClick={finalize}>Chốt phân bổ</button>}
 <button disabled={busy} onClick={()=>set(null)}>Đóng bản xem trước</button></>}</section>;
}
