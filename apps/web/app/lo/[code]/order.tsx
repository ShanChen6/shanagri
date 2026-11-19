'use client';
import { lastReceipt, rememberReceipt } from '../../../lib/last-receipt';
import { formatKg, formatVnd } from '../../../lib/format';
import { Button, Card, StatusMessage, TextField } from '../../../components/ui';
import {useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
type OrderOffer = { remainingKg: number; priceVnd: number };

export default function Order({code,offer}:{code:string;offer:OrderOffer|null}){
 const remaining=offer?.remainingKg??0;
 const [kg,setKg]=useState(1),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false);
 const [phone,P]=useState('');
 const [link,L]=useState(''),secret=useRef('');
 const key=useRef(''),lock=useRef(false),router=useRouter();
 useEffect(()=>{
   function restoreLink(){
     const saved=lastReceipt();
     L(saved?.batch===code ? location.origin+'/tra-cuu-don#'+saved.token : '');
   }
   restoreLink();
   // A restored page may predate forgetting the link on the lookup page.
   function restoreFromHistory(event:PageTransitionEvent){
     if(event.persisted)restoreLink();
   }
   window.addEventListener('pageshow',restoreFromHistory);
   return ()=>window.removeEventListener('pageshow',restoreFromHistory);
 },[code]);
 async function submit(){
   if(lock.current || !offer || kg<1 || kg>offer.remainingKg)return;
   lock.current=true;setBusy(true);setMsg('');
   try{
     key.current ||= crypto.randomUUID();
     secret.current ||= Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
     const res=await fetch('/api/preorder',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,phone,id:key.current,kg,expectedPriceVnd:offer.priceVnd,lookupToken:secret.current})});
     if(res.ok){const o=await res.json();setMsg('Đã giữ '+formatKg(o.kg)+'. Mở liên kết bên dưới để xác minh số điện thoại trong 10 phút.');rememberReceipt({batch:code,token:secret.current});L(location.origin+'/tra-cuu-don#'+secret.current);secret.current='';key.current='';}
     else if(res.status===409){
       const problem=await res.json();
       setMsg(problem.error==='INSUFFICIENT_STOCK'?
         (problem.remainingKg===0?'Lô đã hết hàng. Chưa tạo đơn.':'Chỉ còn '+formatKg(problem.remainingKg)+'. Vui lòng chỉnh số lượng; chưa tạo đơn.'):'Không thể giữ chỗ. Hãy kiểm tra lại lô.');
     }else if(res.status===429){
       const problem=await res.json();
       setMsg(problem.retrySeconds?'Chưa thể giữ thêm hàng. Vui lòng thử lại sau khoảng '+Math.ceil(problem.retrySeconds/60)+' phút.':'Đang có nhiều yêu cầu. Vui lòng thử lại sau.');
     }else setMsg(res.status===503?'Dịch vụ SMS chưa sẵn sàng.':res.status===400?'Kiểm tra số điện thoại và số kg.':res.status===410?'Đã hết hạn nhận đơn.':res.status===412?'Giá đã thay đổi. Vui lòng xem giá mới trước khi đặt lại.':res.status===409?'Không đủ số lượng hoặc lô đã ngừng nhận đơn.':'Chưa xác nhận được đơn. Hãy thử lại.');
     router.refresh();
   }catch{setMsg('Chưa xác nhận được đơn. Hãy thử lại.');}
   finally{lock.current=false;setBusy(false);}
 }
 if(!offer && !link && !msg && !busy)return null;

 return <Card id="dat-truoc"><h2>{offer?'Đặt trước thử nghiệm':'Kết quả đặt trước'}</h2>
 {offer&&<><p>{formatVnd(offer.priceVnd)}/kg · Còn {formatKg(remaining)}</p>
 <p>Mỗi số điện thoại được tạo tối đa 3 đơn trong 1 giờ, kể cả đơn đã hủy, và chỉ được giữ 1 đơn chờ OTP cùng lúc.</p><form onSubmit={e=>{e.preventDefault();void submit()}}><TextField label="Số điện thoại" hint="Dùng số di động Việt Nam để nhận mã xác minh." required type="tel" autoComplete="tel" value={phone} disabled={busy} onChange={e=>P(e.target.value)}/><TextField label="Số kg" error={kg>remaining && remaining>0 ? `Chỉ còn ${formatKg(remaining)}. Vui lòng chỉnh số lượng.` : undefined} type="number" min={1} max={remaining} required disabled={busy} value={kg||''} onChange={e=>{setMsg('');setKg(Number(e.target.value));key.current='';secret.current='';}}/>
 <Button type="submit" disabled={busy||remaining<1||kg>remaining}>{remaining?'Giữ chỗ (không thanh toán)':'Đã hết hạn mức'}</Button></form></>}<StatusMessage>{busy?'Đang gửi yêu cầu giữ chỗ…':msg}</StatusMessage>{link&&<div className="action-row"><a href={link}>Tra cứu đơn vừa đặt</a><Button variant="quiet" onClick={async()=>{try{await navigator.clipboard.writeText(link);setMsg('Đã sao chép liên kết tra cứu.');}catch{setMsg('Hãy sao chép địa chỉ của liên kết tra cứu.');}}}>Sao chép liên kết tra cứu</Button></div>}</Card>
}
