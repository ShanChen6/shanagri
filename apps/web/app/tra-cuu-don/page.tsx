'use client';
import {useEffect,useState} from 'react';
type Receipt={id:string;name:string;kg:number;priceVnd:number;totalVnd:number;batchId:string;status:'PENDING'|'CONFIRMED'|'CANCELLED'};
export default function Lookup(){
 const [order,O]=useState<Receipt|null>(null),[message,M]=useState('Đang tải đơn…'),[version,V]=useState(0);
 useEffect(()=>{
   const reload=()=>V(n=>n+1);
   window.addEventListener('hashchange',reload);
   const c=new AbortController();
   async function load(){
     O(null);M('Đang tải đơn…');
     const token=location.hash.slice(1);
     if(!/^[a-f0-9]{64}$/.test(token)){M('Liên kết không hợp lệ.');return;}
     try{const r=await fetch('/api/lookup',{headers:{authorization:'Bearer '+token},cache:'no-store',signal:c.signal});
       if(!r.ok)throw Error(r.status===404?'Không tìm thấy đơn theo liên kết này.':'Không tải được đơn.');
       const data=await r.json();if(!c.signal.aborted){O(data);M('');}
     }catch(e){if(!c.signal.aborted)M(e instanceof Error?e.message:'Không tải được đơn.');}
   }
   void load();return ()=>{c.abort();window.removeEventListener('hashchange',reload);};
 },[version]);
 return <main><h1>Tra cứu đơn đặt trước</h1><p role="status">{message}</p>{order&&<section>
 <h2>{order.name}</h2><p>Mã đơn: {order.id}</p><p>Trạng thái: {{PENDING:'Chờ xác nhận',CONFIRMED:'Đã xác nhận',CANCELLED:'Đã hủy'}[order.status]}</p>
 <p>{order.kg} kg × {order.priceVnd.toLocaleString('vi-VN')} ₫/kg · Tổng tiền: {order.totalVnd.toLocaleString('vi-VN')} ₫</p>
 <a href={'/lo/'+encodeURIComponent(order.batchId)}>Truy xuất nguồn gốc lô</a></section>}
 <button onClick={()=>V(n=>n+1)}>Cập nhật trạng thái</button></main>;
}
