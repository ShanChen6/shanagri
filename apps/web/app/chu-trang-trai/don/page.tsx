'use client';
import AllocationPreview from './allocation-preview';
import {useState} from 'react';
type Order={id:string;kg:number;batchId:string;priceVnd:number;cancelRequested:boolean;cancelDecision:string|null;status:'HOLD'|'EXPIRED'|'PENDING'|'CONFIRMED'|'CANCELLED'};
const label={HOLD:'Chờ OTP',EXPIRED:'Hết hạn',PENDING:'Chờ xác nhận',CONFIRMED:'Đã xác nhận',CANCELLED:'Đã hủy'};
export default function Orders(){
 const [key,K]=useState(''),[rows,R]=useState<Order[]|null>(null),[page,P]=useState(1),[more,M]=useState(false),[msg,S]=useState(''),[busy,B]=useState(false);
 const [filter,F]=useState('');
 const [offers,O]=useState<{batchId:string;open:boolean;closesAt:string|null;priceVnd:number;remainingKg:number;totalKg:number;heldKg:number;actualKg:number|null;harvestDate:string|null}[]>([]);
 const [zones,Z]=useState<{id:string;name:string}[]>([]),[drafts,D]=useState<{id:string;name:string;zoneId:string;startDate:string;expectedHarvestDate:string}[]>([]);
 async function publish(form:HTMLFormElement,d:(typeof drafts)[number]){
   const data=new FormData(form),priceVnd=Number(data.get('price')),totalKg=Number(data.get('kg'));
   const local=String(data.get('deadline')??'');
   const closesAt=local?new Date(local+':00+07:00').toISOString():null;
   const zone=zones.find(z=>z.id===d.zoneId)?.name??d.zoneId;
   if(!confirm([d.name+' · '+d.id,zone+' · '+d.startDate.slice(0,10)+' – '+d.expectedHarvestDate.slice(0,10),
     priceVnd.toLocaleString('vi-VN')+' ₫/kg · Nhận đặt trước '+totalKg+' kg',local?'Nhận đến '+local.replace('T',' ')+' (giờ Việt Nam)':'Không đặt hạn chốt','Công bố và mở bán trên chợ?'].join('\n')))return;
   B(true);S('');
   try{
     const r=await fetch('/api/owner-publish',{method:'POST',headers:{authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({code:d.id,priceVnd,totalKg,closesAt})});
     if(r.status===422)throw Error('Hạn chốt phải ở tương lai.');
     if(!r.ok)throw Error('Không thể công bố lô. Hãy tải lại danh sách.');
     await load(page);S(r.status===201?'Đã công bố và mở bán lô '+d.id:'Lô đã được công bố trước đó.');
   }catch(e){S(e instanceof Error?e.message:'Chưa xác nhận được kết quả.');}finally{B(false);}
 }
 async function createDraft(form:HTMLFormElement){
   B(true);S('');
   try{
     const r=await fetch('/api/owner-drafts',{method:'POST',headers:{authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(form)))});
     const data=await r.json();
     if(!r.ok)throw Error(data.error??'Không tạo được lô nháp.');
     form.reset();await load(page);S('Đã tạo lô nháp '+data.id);
   }catch(e){S(e instanceof Error?e.message:'Không kết nối được.');}finally{B(false);}
 }
 async function load(n:number,id?:string,action?:string,offer?:{batchId:string;open?:boolean;priceVnd?:number;totalKg?:number;actualKg?:number;harvestDate?:string},batch=filter){
   B(true);S('');
   const headers={authorization:'Bearer '+key};
   try{
     if(offer){
       const changed=await fetch('/api/owner-orders?code='+encodeURIComponent(offer.batchId),{method:'PUT',
         headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({open:offer.open,priceVnd:offer.priceVnd,totalKg:offer.totalKg,actualKg:offer.actualKg,harvestDate:offer.harvestDate})});
       if(!changed.ok && offer.actualKg!==undefined)throw Error('Không thể chốt. Kiểm tra ngày thu hoạch và tải lại trạng thái lô.');
       if(!changed.ok)throw Error(changed.status===409?'Hạn mức thấp hơn số kg hiện đã giữ. Hãy tải lại danh sách.':'Không cập nhật được lô.');
     }
     if(id){
       const r=await fetch('/api/owner-orders?id='+id+'&action='+action,{method:'POST',headers});
       if(!r.ok)throw Error(r.status===409?'Đơn đã hủy hoặc lô đã chốt phân bổ. Tải lại danh sách.':'Không cập nhật được đơn.');
     }
     const r=await fetch('/api/owner-orders?page='+n+'&batch='+encodeURIComponent(batch),{headers,cache:'no-store'});
     if(!r.ok)throw Error(r.status===401?'Mã truy cập không hợp lệ.':'Không tải được danh sách.');
     const data=await r.json();F(batch);O(data.offers);Z(data.zones);D(data.drafts);R(data.orders);M(data.hasMore);P(n);if(id)S('Đã cập nhật đơn.');if(offer?.totalKg!==undefined)S('Đã cập nhật hạn mức của lô.');if(offer?.actualKg!==undefined)S('Đã chốt thu hoạch.');if(offer?.priceVnd)S('Đã cập nhật giá cho đơn mới.');
   }catch(e){S(e instanceof Error?e.message:'Không kết nối được.');}finally{B(false);}
 }
 return <main><h1>Đơn đặt trước của trang trại</h1><form onSubmit={e=>{e.preventDefault();void load(1);}}>
 <label>Mã truy cập chủ trang trại <input type="password" required disabled={busy} value={key} onChange={e=>{K(e.target.value);R(null);}}/></label>
 <button disabled={busy}>Xem danh sách</button></form><p role="status">{msg}</p>
 {rows && <><h2>Tạo lô nháp</h2><form onSubmit={e=>{e.preventDefault();void createDraft(e.currentTarget);}}>
 <fieldset disabled={busy}><label>Tên lô <input name="name" required maxLength={120}/></label>
 <label>Vùng trồng <select name="zoneId" required>{zones.map(z=><option key={z.id} value={z.id}>{z.name}</option>)}</select></label>
 <label>Ngày bắt đầu <input type="date" name="startDate" required/></label>
 <label>Dự kiến thu hoạch <input type="date" name="expectedHarvestDate" required/></label><button>Lưu lô nháp</button></fieldset></form>
 <h2>Lô chưa công bố</h2>{drafts.length?<ul>{drafts.map(d=><li key={d.id}>{d.name} · {d.id} · {zones.find(z=>z.id===d.zoneId)?.name} · {d.startDate.slice(0,10)} – {d.expectedHarvestDate.slice(0,10)}
 <form onSubmit={e=>{e.preventDefault();void publish(e.currentTarget,d);}}><fieldset disabled={busy}><legend>Điều kiện mở bán</legend>
 <label>Giá (₫/kg) <input name="price" type="number" min="1" max="2147483647" step="1" required/></label>
 <label>Hạn mức (kg) <input name="kg" type="number" min="1" max="2147483647" step="1" required/></label>
 <label>Nhận đơn đến (giờ Việt Nam, không bắt buộc) <input type="datetime-local" name="deadline"/></label>
 <button>Xem lại và mở bán</button></fieldset></form></li>)}</ul>:<p>Chưa có lô nháp.</p>}
 <h2>Nhận đặt trước theo lô</h2>{offers.map(o=><section key={o.batchId}>{o.batchId} · Tổng hạn mức: {o.totalKg} kg · Đã giữ: {o.heldKg} kg · Còn nhận: {o.harvestDate?0:o.remainingKg} kg · {o.harvestDate?'Đã thu hoạch':o.closesAt&&Date.parse(o.closesAt)<=Date.now()?'Đã hết hạn':o.open?'Đang nhận đơn':'Đã tạm dừng'}{' '}
 {o.actualKg!==null?<><p>Thực thu {o.actualKg} kg · {o.actualKg===o.heldKg?'Vừa đủ':o.actualKg<o.heldKg?'Thiếu '+(o.heldKg-o.actualKg)+' kg':'Dư '+(o.actualKg-o.heldKg)+' kg'} · <button disabled={busy} onClick={()=>load(1,undefined,undefined,undefined,o.batchId)}>Xem đơn đang giữ</button></p><AllocationPreview code={o.batchId} ownerKey={key}/></>:<>
 <form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget),actualKg=Number(f.get('actual')),harvestDate=String(f.get('day'));
 if(confirm('Chốt thu hoạch '+actualKg+' kg ngày '+harvestDate+' và ngừng nhận đơn cho '+o.batchId+'?'))void load(page,undefined,undefined,{batchId:o.batchId,actualKg,harvestDate});}}>
 <label>Ngày thực thu <input type="date" name="day" required/></label><label>Sản lượng thực thu (kg) <input type="number" min="0" max="2147483647" step="1" name="actual" required/></label>
 <button disabled={busy}>Chốt thu hoạch</button></form>
 <button disabled={busy} onClick={()=>load(page,undefined,undefined,{batchId:o.batchId,open:!o.open})}>{o.open?'Tạm dừng nhận đơn':'Mở lại'}</button>
 <form key={'cap'+o.totalKg} onSubmit={e=>{e.preventDefault();void load(page,undefined,undefined,{batchId:o.batchId,totalKg:Number(new FormData(e.currentTarget).get('capacity'))});}}>
 <label>Tổng hạn mức mới (kg) <input name="capacity" type="number" min={o.heldKg} max={2147483647} step={1} defaultValue={o.totalKg} required disabled={busy}/></label>
 <button disabled={busy}>Lưu hạn mức</button></form>
 <form key={o.priceVnd} onSubmit={e=>{e.preventDefault();void load(page,undefined,undefined,{batchId:o.batchId,priceVnd:Number(new FormData(e.currentTarget).get('price'))});}}>
 <label>Giá bán (₫/kg) <input name="price" type="number" required min={1} max={2147483647} step={1} defaultValue={o.priceVnd} disabled={busy}/></label>
 <button disabled={busy}>Lưu giá</button></form></>}</section>)}<h2>Danh sách đơn</h2>{filter&&<p>Lô {filter} · <button disabled={busy} onClick={()=>load(1,undefined,undefined,undefined,'')}>Xem tất cả đơn</button></p>}<p>Trang {page} · {rows.length} đơn</p>{rows.map(o=><section key={o.id}><h2>Lô {o.batchId}</h2>
 <p>{o.id} · {o.kg} kg · {(o.kg*o.priceVnd).toLocaleString('vi-VN')} ₫ · {label[o.status]} {o.cancelRequested?'· Khách yêu cầu hủy':o.cancelDecision==='APPROVED'?'· Đã duyệt hủy':o.cancelDecision==='DECLINED'?'· Đã từ chối yêu cầu hủy':''}</p>
 {o.status==='PENDING'&&<button disabled={busy} onClick={()=>load(page,o.id,'confirm')}>Xác nhận</button>}
 {o.cancelRequested&&<><button disabled={busy} onClick={()=>{if(confirm('Duyệt hủy và hoàn '+o.kg+' kg?'))void load(page,o.id,'approve-cancel');}}>Duyệt hủy</button>
 <button disabled={busy} onClick={()=>{if(confirm('Từ chối yêu cầu hủy và giữ nguyên đơn?'))void load(page,o.id,'decline-cancel');}}>Từ chối hủy</button></>}
 {!o.cancelRequested&&!['CANCELLED','EXPIRED'].includes(o.status)&&<button disabled={busy} onClick={()=>{if(confirm('Hủy đơn và hoàn '+o.kg+' kg cho lô?'))void load(page,o.id,'cancel');}}>Hủy đơn</button>}</section>)}
 <button disabled={busy||page===1} onClick={()=>load(page-1)}>Trang trước</button><button disabled={busy||!more} onClick={()=>load(page+1)}>Trang sau</button></>}
 </main>;
}
