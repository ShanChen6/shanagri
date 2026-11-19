'use client';
import {useState} from 'react';
type Order={id:string;kg:number;createdAt:string};
type Plan={version:string;allocatedAt:string|null;actualKg:number;remainingKg:number;confirmed:(Order&{proposedKg:number;missingKg:number})[];pending:Order[]};
export default function AllocationPreview({code,ownerKey}:{code:string;ownerKey:string}){
 const [plan,set]=useState<Plan|null>(null),[busy,B]=useState(false),[error,E]=useState('');
 const sum=plan?plan.actualKg-plan.remainingKg:0;
 const invalid=!plan||!plan.confirmed.length||!!plan.pending.length;
 async function finalize(){
   if(!plan||invalid||!confirm('Chốt phân bổ '+sum+' kg? Khách sẽ thấy kết quả trên liên kết tra cứu.'))return;
   B(true);E('');
   try{
     const r=await fetch('/api/allocation-preview?code='+encodeURIComponent(code),{method:'POST',headers:{authorization:'Bearer '+ownerKey,'Content-Type':'application/json'},
       body:JSON.stringify({version:plan.version,items:plan.confirmed.map(o=>({id:o.id,kg:o.proposedKg}))})});
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
     const next:Plan=await r.json();set(next);
   }catch{set(null);E('Không tải được phương án. Vui lòng thử lại.');}finally{B(false);}
 }
 return <section><button disabled={busy} onClick={load}>{busy?'Đang tải…':plan?'Cập nhật bản xem trước':'Xem trước phân bổ'}</button>
 <span role="status">{error}</span>{plan&&<><h3>{plan.allocatedAt?'Phân bổ đã chốt':'Đề xuất phân bổ'} · {code}</h3>
 <p>Thực thu {plan.actualKg} kg · Đề xuất giao {sum} kg · Chưa phân bổ {plan.actualKg-sum} kg.</p>
 <p>{plan.allocatedAt?'Khách có thể tra cứu kết quả.':'Đơn đặt trước nhận đủ trước, đơn kế tiếp nhận phần còn lại. Hãy xác nhận hoặc hủy hết đơn đang chờ.'}</p>
 {plan.confirmed.length?<table><thead><tr><th>Mã đơn</th><th>Thời điểm đặt (giờ Việt Nam)</th><th>Đã đặt</th><th>Đề xuất giao</th><th>Thiếu</th></tr></thead>
 <tbody>{plan.confirmed.map(o=><tr key={o.id}><td>{o.id}</td><td>{new Date(o.createdAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}</td><td>{o.kg} kg</td><td>{o.proposedKg} kg</td><td>{o.missingKg} kg</td></tr>)}</tbody></table>:<p>Chưa có đơn đã xác nhận.</p>}
 <h4>Chờ xác nhận · chưa phân bổ</h4>{plan.pending.length?<ul>{plan.pending.map(o=><li key={o.id}>{o.id} · Đặt {o.kg} kg</li>)}</ul>:<p>Không có đơn chờ xác nhận.</p>}
 {!plan.allocatedAt&&<button disabled={busy||invalid} onClick={finalize}>Chốt phân bổ</button>}
 <button disabled={busy} onClick={()=>set(null)}>Đóng bản xem trước</button></>}</section>;
}
