'use client';
import {useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
export default function Order({code,remaining,price}:{code:string;remaining:number;price:number}){
 const [kg,setKg]=useState(1),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false);
 const [link,L]=useState(''),secret=useRef('');
 const key=useRef(''),lock=useRef(false),router=useRouter();
 async function submit(){
   if(lock.current)return;lock.current=true;setBusy(true);setMsg('');
   try{
     key.current ||= crypto.randomUUID();
     secret.current ||= Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
     const res=await fetch('/api/preorder',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,id:key.current,kg,expectedPriceVnd:price,lookupToken:secret.current})});
     if(res.ok){const o=await res.json();setMsg('Đã giữ '+o.kg+' kg. Mã đơn mẫu: '+o.id);L(location.origin+'/tra-cuu-don#'+secret.current);secret.current='';key.current='';}
     else if(res.status===409){
       const problem=await res.json();
       setMsg(problem.error==='INSUFFICIENT_STOCK'?
         (problem.remainingKg===0?'Lô đã hết hàng. Chưa tạo đơn.':'Chỉ còn '+problem.remainingKg+' kg. Vui lòng chỉnh số lượng; chưa tạo đơn.'):'Không thể giữ chỗ. Hãy kiểm tra lại lô.');
     }else setMsg(res.status===410?'Đã hết hạn nhận đơn.':res.status===412?'Giá đã thay đổi. Vui lòng xem giá mới trước khi đặt lại.':res.status===409?'Không đủ số lượng hoặc lô đã ngừng nhận đơn.':'Chưa xác nhận được đơn. Hãy thử lại.');
     router.refresh();
   }catch{setMsg('Chưa xác nhận được đơn. Hãy thử lại.');}
   finally{lock.current=false;setBusy(false);}
 }
 return <section><h2>Đặt trước thử nghiệm</h2><p>{price.toLocaleString('vi-VN')} ₫/kg · Còn {remaining} kg</p>
 <form onSubmit={e=>{e.preventDefault();void submit()}}><label>Số kg <input type="number" min={1} max={remaining} required disabled={busy} value={kg||''} onChange={e=>{setMsg('');setKg(Number(e.target.value));key.current='';secret.current='';}}/></label>
 {kg>remaining && remaining>0 && <p>Chỉ còn {remaining} kg. Vui lòng chỉnh số lượng.</p>}
 <button disabled={busy||remaining<1||kg>remaining}>{remaining?'Giữ chỗ (không thanh toán)':'Đã hết hạn mức'}</button></form><p role="status">{msg}</p>{link&&<p><a href={link}>Tra cứu đơn vừa đặt</a>{' '}<button onClick={async()=>{try{await navigator.clipboard.writeText(link);setMsg('Đã sao chép liên kết tra cứu.');}catch{setMsg('Hãy sao chép địa chỉ của liên kết tra cứu.');}}}>Sao chép liên kết tra cứu</button></p>}</section>
}
