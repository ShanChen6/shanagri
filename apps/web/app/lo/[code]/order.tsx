'use client';
import {useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
export default function Order({code,remaining,price}:{code:string;remaining:number;price:number}){
 const [kg,setKg]=useState(1),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false);
 const key=useRef(''),lock=useRef(false),router=useRouter();
 async function submit(){
   if(lock.current)return;lock.current=true;setBusy(true);setMsg('');
   try{
     key.current ||= crypto.randomUUID();
     const res=await fetch('/api/preorder',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,id:key.current,kg,expectedPriceVnd:price})});
     if(res.ok){const o=await res.json();setMsg('Đã giữ '+o.kg+' kg. Mã đơn mẫu: '+o.id);key.current='';}
     else setMsg(res.status===412?'Giá đã thay đổi. Vui lòng xem giá mới trước khi đặt lại.':res.status===409?'Không đủ số lượng hoặc lô đã ngừng nhận đơn.':'Chưa xác nhận được đơn. Hãy thử lại.');
     router.refresh();
   }catch{setMsg('Chưa xác nhận được đơn. Hãy thử lại.');}
   finally{lock.current=false;setBusy(false);}
 }
 return <section><h2>Đặt trước thử nghiệm</h2><p>{price.toLocaleString('vi-VN')} ₫/kg · Còn {remaining} kg</p>
 <form onSubmit={e=>{e.preventDefault();void submit()}}><label>Số kg <input type="number" min={1} max={remaining} required disabled={busy} value={kg||''} onChange={e=>{setKg(Number(e.target.value));key.current='';}}/></label>
 <button disabled={busy||remaining<1}>{remaining?'Giữ chỗ (không thanh toán)':'Đã hết hạn mức'}</button></form><p role="status">{msg}</p></section>
}
