'use client';
import { forgetReceipt, lastReceipt, lookupTokenPattern } from '../../lib/last-receipt';
import { formatClockTime, formatKg, formatVnd } from '../../lib/format';
import { FulfillmentStatus, type FulfillmentTimes } from '../../components/orders/fulfillment-status';
import { OrderStatusBadge, type OrderStatus } from '../../components/orders/order-status-badge';
import { Button, Card, PageContainer, StatusMessage, TextField } from '../../components/ui';
import {useEffect,useRef,useState} from 'react';
type Receipt=FulfillmentTimes&{allocatedKg:number|null;id:string;name:string;kg:number;priceVnd:number;totalVnd:number;batchId:string;expiresAt:string|null;cancelRequested:boolean;cancelDecision:string|null;status:OrderStatus};
type LookupAction = 'verify' | 'resend' | 'cancel';

export default function Lookup(){
 const [token,setToken]=useState<string|null>(null);
 const [saved,setSaved]=useState<ReturnType<typeof lastReceipt>>(null);
 const [storageError,setStorageError]=useState('');


 useEffect(()=>{
   const readToken=()=>{
     setToken(window.location.hash.slice(1));
     setSaved(lastReceipt());
     setStorageError('');
   };
   window.addEventListener('hashchange',readToken);
   window.addEventListener('pageshow',readToken);
   readToken();
   return ()=>{
     window.removeEventListener('hashchange',readToken);
     window.removeEventListener('pageshow',readToken);
   };
 },[]);

 return (
   <PageContainer>
     <h1>Tra cứu đơn đặt trước</h1>
     {token===null ? <StatusMessage>Đang tải đơn…</StatusMessage> :
       token==='' ? (
         <Card as="section">
           <h2>Đơn gần nhất trong thẻ này</h2>
           {saved ? <>
             <p>Liên kết đã lưu cho lô <span className="record-id">{saved.batch}</span>.</p>
             <div className="action-row">
               <a href={'#'+saved.token}>Mở đơn gần nhất</a>
               <Button variant="quiet" onClick={()=>{
                 if(forgetReceipt(saved.token)){setSaved(null);setStorageError('');}
                 else setStorageError('Chưa xóa được bản lưu. Vui lòng thử lại.');
               }}>Quên liên kết trong thẻ này</Button>
             </div>
             <p>Quên liên kết chỉ xóa bản lưu trong thẻ này. URL riêng vẫn tra cứu được.</p>
             <StatusMessage>{storageError}</StatusMessage>
           </> : <p>Mở liên kết riêng đã nhận khi đặt trước để xem trạng thái đơn.</p>}
         </Card>
       ) : !lookupTokenPattern.test(token) ? <StatusMessage>Liên kết không hợp lệ.</StatusMessage> :
       <ReceiptLookup key={token} token={token}/>}
   </PageContainer>
 );
}

function ReceiptLookup({token}:{token:string}){
 const [order,O]=useState<Receipt|null>(null),[message,M]=useState('Đang tải đơn…'),[version,V]=useState(0);
 const [code,C]=useState(''),[phone,P]=useState(''),[pendingAction,setPendingAction]=useState<LookupAction|null>(null),[notice,N]=useState('');
 const requestInFlight=useRef<AbortController|null>(null);
 useEffect(()=>()=>requestInFlight.current?.abort(),[]);
 const busy=pendingAction!==null;
 const canVerify=/^\d{6}$/.test(code);
 const canResend=phone.trim().length>0;
 async function change(action:LookupAction){
   if(requestInFlight.current || (action==='verify'&&!canVerify) || (action==='resend'&&!canResend))return;
   const request=new AbortController();
   requestInFlight.current=request;
   setPendingAction(action);
   N('');
   try{
     const r=await fetch('/api/lookup?action='+action,{method:'POST',headers:{authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({code,phone}),signal:request.signal});
     if(request.signal.aborted)return;
     if(r.ok && (action==='verify'||action==='resend'))C('');
     N(r.ok?(action==='resend'?'Đã gửi mã mới.':'Đã cập nhật.'):r.status===429?'Đã đạt giới hạn. Vui lòng đợi.':r.status===410?'Giữ chỗ đã hết hạn.':r.status===503?'Chưa gửi được SMS. Vui lòng thử lại sau.':'Không thể thực hiện. Kiểm tra mã hoặc số điện thoại.');
     V(n=>n+1);
   }catch{if(!request.signal.aborted)N('Không kết nối được.');}finally{
     requestInFlight.current=null;
     if(!request.signal.aborted)setPendingAction(null);
   }
 }
 useEffect(()=>{
   const c=new AbortController();
   async function load(){
     M(version===0?'Đang tải đơn…':'Đang cập nhật trạng thái…');
     try{const r=await fetch('/api/lookup',{headers:{authorization:'Bearer '+token},cache:'no-store',signal:c.signal});
       if(c.signal.aborted)return;
       if(r.status===404){
         forgetReceipt(token);
         O(null);M('Không tìm thấy đơn theo liên kết này.');return;
       }
       if(!r.ok)throw Error('Không tải được đơn.');
       const data=await r.json();if(!c.signal.aborted){O(data);M('');}
     }catch(e){if(!c.signal.aborted)M(e instanceof Error?e.message:'Không tải được đơn.');}
   }
   void load();return ()=>c.abort();
 },[token,version]);
 return <><StatusMessage>{message}</StatusMessage>{order&&<section>
 <h2>{order.name}</h2><p>Mã đơn: <span className="record-id">{order.id}</span></p><p>Trạng thái: <OrderStatusBadge status={order.status}/></p>
 {order.status==='HOLD'&&<>{order.expiresAt && <p>Giữ chỗ đến <time dateTime={order.expiresAt}>{formatClockTime(order.expiresAt)}</time> (giờ Việt Nam).</p>}
 <form onSubmit={event=>{event.preventDefault();void change('verify');}}>
   <TextField label="Mã OTP" hint="Nhập mã 6 chữ số trong tin nhắn SMS." autoComplete="one-time-code"
     value={code} onChange={event=>C(event.target.value)} inputMode="numeric" maxLength={6} required disabled={busy}/>
   <Button type="submit" disabled={busy||!canVerify}>
     {pendingAction==='verify'?'Đang xác minh…':'Xác minh số điện thoại'}
   </Button>
 </form>
 <details>
   <summary>Chưa nhận được mã?</summary>
   <form onSubmit={event=>{event.preventDefault();void change('resend');}}>
     <TextField label="Số điện thoại đã đặt" type="tel" autoComplete="tel"
       value={phone} onChange={event=>P(event.target.value)} required disabled={busy}/>
     <Button type="submit" variant="quiet" size="sm" disabled={busy||!canResend}>
       {pendingAction==='resend'?'Đang gửi mã…':'Gửi lại mã'}
     </Button>
   </form>
 </details></>}
 {order.cancelDecision&&<p>{order.cancelDecision==='APPROVED'?'Chủ trại đã duyệt yêu cầu hủy.':'Chủ trại đã từ chối yêu cầu hủy.'}</p>}
 {!order.cancelDecision&&['HOLD','PENDING','CONFIRMED'].includes(order.status)&&order.allocatedKg===null&&<Button disabled={busy||order.cancelRequested} onClick={()=>{if(confirm('Bạn muốn hủy đơn này?'))void change('cancel')}}>{order.cancelRequested?'Đã gửi yêu cầu hủy':order.status==='CONFIRMED'?'Yêu cầu chủ trại duyệt hủy':'Hủy giữ chỗ'}</Button>}
 {order.allocatedKg!==null&&<section aria-label="Kết quả phân bổ">
   <h3>Kết quả phân bổ</h3>
   <p>Đã đặt: {formatKg(order.kg)} · Được phân bổ: {formatKg(order.allocatedKg)}</p>
   {order.allocatedKg===0
     ? <p>Đơn này không có hàng để giao theo kết quả phân bổ.</p>
     : <>
       <p>Giá trị theo số lượng giao: <strong>{formatVnd(BigInt(order.allocatedKg)*BigInt(order.priceVnd))}</strong></p>
       <p>Tiến độ giao hàng: <FulfillmentStatus packedAt={order.packedAt} deliveredAt={order.deliveredAt}/></p>
     </>}
 </section>}
 <p>{formatKg(order.kg)} × {formatVnd(order.priceVnd)}/kg · Giá trị đặt ban đầu: {formatVnd(order.totalVnd)}</p>
 <a href={'/lo/'+encodeURIComponent(order.batchId)}>Truy xuất nguồn gốc lô</a></section>}
 <StatusMessage>{notice}</StatusMessage><Button disabled={busy} onClick={()=>V(n=>n+1)}>Cập nhật trạng thái</Button></>;
}
