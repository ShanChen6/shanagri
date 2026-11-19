'use client';
import {useEffect,useState} from 'react';
type Receipt={allocatedKg:number|null;id:string;name:string;kg:number;priceVnd:number;totalVnd:number;batchId:string;expiresAt:string|null;cancelRequested:boolean;status:'HOLD'|'EXPIRED'|'PENDING'|'CONFIRMED'|'CANCELLED'};
export default function Lookup(){
 const [order,O]=useState<Receipt|null>(null),[message,M]=useState('Đang tải đơn…'),[version,V]=useState(0);
 const [code,C]=useState(''),[phone,P]=useState(''),[busy,B]=useState(false),[notice,N]=useState('');
 async function change(action:string){
   B(true);N('');
   try{
     const r=await fetch('/api/lookup?action='+action,{method:'POST',headers:{authorization:'Bearer '+location.hash.slice(1),'Content-Type':'application/json'},body:JSON.stringify({code,phone})});
     N(r.ok?(action==='resend'?'Đã gửi mã mới.':'Đã cập nhật.'):r.status===429?'Đã đạt giới hạn. Vui lòng đợi.':r.status===410?'Giữ chỗ đã hết hạn.':r.status===503?'Chưa gửi được SMS. Vui lòng thử lại sau.':'Không thể thực hiện. Kiểm tra mã hoặc số điện thoại.');
     V(n=>n+1);
   }catch{N('Không kết nối được.');}finally{B(false);}
 }
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
 <h2>{order.name}</h2><p>Mã đơn: {order.id}</p><p>Trạng thái: {{HOLD:'Chờ xác minh điện thoại',EXPIRED:'Đã hết hạn giữ chỗ',PENDING:'Chờ xác nhận',CONFIRMED:'Đã xác nhận',CANCELLED:'Đã hủy'}[order.status]}</p>
 {order.status==='HOLD'&&<><p>Giữ chỗ đến {new Date(order.expiresAt!).toLocaleTimeString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})} (giờ Việt Nam).</p>
 <label>Mã OTP <input value={code} onChange={e=>C(e.target.value)} inputMode="numeric" maxLength={6}/></label>
 <button disabled={busy||code.length!==6} onClick={()=>change('verify')}>Xác minh số điện thoại</button>
 <details><summary>Chưa nhận được mã?</summary><label>Số điện thoại đã đặt <input value={phone} onChange={e=>P(e.target.value)}/></label>
 <button disabled={busy} onClick={()=>change('resend')}>Gửi lại mã</button></details></>}
 {['HOLD','PENDING','CONFIRMED'].includes(order.status)&&order.allocatedKg===null&&<button disabled={busy||order.cancelRequested} onClick={()=>{if(confirm('Bạn muốn hủy đơn này?'))void change('cancel')}}>{order.cancelRequested?'Đã gửi yêu cầu hủy':order.status==='CONFIRMED'?'Yêu cầu chủ trại duyệt hủy':'Hủy giữ chỗ'}</button>}
 {order.allocatedKg!==null&&<p>Đã đặt: {order.kg} kg · Được phân bổ: {order.allocatedKg} kg</p>}
 <p>{order.kg} kg × {order.priceVnd.toLocaleString('vi-VN')} ₫/kg · Giá trị đặt ban đầu: {order.totalVnd.toLocaleString('vi-VN')} ₫</p>
 <a href={'/lo/'+encodeURIComponent(order.batchId)}>Truy xuất nguồn gốc lô</a></section>}
 <p role="status">{notice}</p><button onClick={()=>V(n=>n+1)}>Cập nhật trạng thái</button></main>;
}
