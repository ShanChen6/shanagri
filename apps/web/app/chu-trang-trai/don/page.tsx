'use client';
import {useState} from 'react';
type Order={id:string;kg:number;batchId:string;priceVnd:number;status:'PENDING'|'CONFIRMED'|'CANCELLED'};
const label={PENDING:'Chờ xác nhận',CONFIRMED:'Đã xác nhận',CANCELLED:'Đã hủy'};
export default function Orders(){
 const [key,K]=useState(''),[rows,R]=useState<Order[]|null>(null),[page,P]=useState(1),[more,M]=useState(false),[msg,S]=useState(''),[busy,B]=useState(false);
 async function load(n:number,id?:string,action?:string){
   B(true);S('');
   const headers={authorization:'Bearer '+key};
   try{
     if(id){
       const r=await fetch('/api/owner-orders?id='+id+'&action='+action,{method:'POST',headers});
       if(!r.ok)throw Error(r.status===409?'Đơn đã hủy. Tải lại danh sách.':'Không cập nhật được đơn.');
     }
     const r=await fetch('/api/owner-orders?page='+n,{headers,cache:'no-store'});
     if(!r.ok)throw Error(r.status===401?'Mã truy cập không hợp lệ.':'Không tải được danh sách.');
     const data=await r.json();R(data.orders);M(data.hasMore);P(n);if(id)S('Đã cập nhật đơn.');
   }catch(e){S(e instanceof Error?e.message:'Không kết nối được.');}finally{B(false);}
 }
 return <main><h1>Đơn đặt trước của trang trại</h1><form onSubmit={e=>{e.preventDefault();void load(1);}}>
 <label>Mã truy cập chủ trang trại <input type="password" required disabled={busy} value={key} onChange={e=>{K(e.target.value);R(null);}}/></label>
 <button disabled={busy}>Xem danh sách</button></form><p role="status">{msg}</p>
 {rows && <><p>Trang {page} · {rows.length} đơn</p>{rows.map(o=><section key={o.id}><h2>Lô {o.batchId}</h2>
 <p>{o.id} · {o.kg} kg · {(o.kg*o.priceVnd).toLocaleString('vi-VN')} ₫ · {label[o.status]}</p>
 {o.status==='PENDING'&&<button disabled={busy} onClick={()=>load(page,o.id,'confirm')}>Xác nhận</button>}
 {o.status!=='CANCELLED'&&<button disabled={busy} onClick={()=>{if(confirm('Hủy đơn và hoàn '+o.kg+' kg cho lô?'))void load(page,o.id,'cancel');}}>Hủy đơn</button>}</section>)}
 <button disabled={busy||page===1} onClick={()=>load(page-1)}>Trang trước</button><button disabled={busy||!more} onClick={()=>load(page+1)}>Trang sau</button></>}
 </main>;
}
