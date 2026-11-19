'use client';
import {useState} from 'react';
type Order={id:string;kg:number;createdAt:string};
type Plan={actualKg:number;remainingKg:number;confirmed:(Order&{proposedKg:number;missingKg:number})[];pending:Order[]};
export default function AllocationPreview({code,ownerKey}:{code:string;ownerKey:string}){
 const [plan,set]=useState<Plan|null>(null),[busy,B]=useState(false),[error,E]=useState('');
 async function load(){
   B(true);E('');
   try{
     const r=await fetch('/api/allocation-preview?code='+encodeURIComponent(code),{headers:{authorization:'Bearer '+ownerKey},cache:'no-store'});
     if(!r.ok)throw Error();
     set(await r.json());
   }catch{set(null);E('Không tải được phương án. Vui lòng thử lại.');}finally{B(false);}
 }
 return <section><button disabled={busy} onClick={load}>{busy?'Đang tải…':plan?'Cập nhật bản xem trước':'Xem trước phân bổ'}</button>
 <span role="status">{error}</span>{plan&&<><h3>Đề xuất cho lô {code}</h3>
 <p>Thực thu {plan.actualKg} kg · Đề xuất giao {plan.actualKg-plan.remainingKg} kg · Chưa phân bổ {plan.remainingKg} kg.</p>
 <p>Chỉ xem trước. Đơn đã xác nhận được ưu tiên theo thời điểm đặt.</p>
 {plan.confirmed.length?<table><thead><tr><th>Mã đơn</th><th>Thời điểm đặt (giờ Việt Nam)</th><th>Đã đặt</th><th>Đề xuất giao</th><th>Thiếu</th></tr></thead>
 <tbody>{plan.confirmed.map(o=><tr key={o.id}><td>{o.id}</td><td>{new Date(o.createdAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}</td><td>{o.kg} kg</td><td>{o.proposedKg} kg</td><td>{o.missingKg} kg</td></tr>)}</tbody></table>:<p>Chưa có đơn đã xác nhận.</p>}
 <h4>Chờ xác nhận · chưa phân bổ</h4>{plan.pending.length?<ul>{plan.pending.map(o=><li key={o.id}>{o.id} · Đặt {o.kg} kg</li>)}</ul>:<p>Không có đơn chờ xác nhận.</p>}
 <button onClick={()=>set(null)}>Đóng bản xem trước</button></>}</section>;
}
