'use client';
import { formatCalendarDate, formatDateTime, formatKg, formatVnd } from '../../../lib/format';
import { FulfillmentStatus, type FulfillmentTimes } from '../../../components/orders/fulfillment-status';
import { OrderStatusBadge, type OrderStatus } from '../../../components/orders/order-status-badge';
import { Button, CalendarDate, Card, PageContainer, SelectField, StatePanel, StatusMessage, TextField } from '../../../components/ui';
import { defaultFilters, OwnerOrderFilters, type FulfillmentCounts } from './order-filters';
import { BulkFulfillmentActions } from './bulk-fulfillment-actions';
import { FulfillmentQueue } from './fulfillment-queue';
import AllocationPreview from './allocation-preview';
import {useRef,useState} from 'react';
type Order=FulfillmentTimes&{allocatedKg:number|null;offer:{allocatedAt:string|null};id:string;kg:number;batchId:string;priceVnd:number;cancelRequested:boolean;cancelDecision:string|null;status:OrderStatus};
export default function Orders(){
 const [key,K]=useState(''),[rows,R]=useState<Order[]|null>(null),[page,P]=useState(1),[more,M]=useState(false),[msg,S]=useState(''),[busy,B]=useState(false);
 const [filters,setFilters]=useState(defaultFilters),[pendingCount,setPendingCount]=useState(0);
 const [total,setTotal]=useState(0);
 const [fulfillmentCounts,setFulfillmentCounts]=useState<FulfillmentCounts>({packing:0,delivery:0,delivered:0});
 const [selectedIds,setSelectedIds]=useState<string[]>([]),[bulkNotice,setBulkNotice]=useState('');
 const bulkAction=filters.fulfillment==='packing'?'pack':filters.fulfillment==='delivery'?'deliver':null;
 const eligibleRows=bulkAction?(rows??[]).filter(order=>
   order.offer.allocatedAt && (order.allocatedKg??0)>0 && !order.deliveredAt &&
   (bulkAction==='pack'?!order.packedAt:!!order.packedAt)
 ):[];
 const selectedRows=eligibleRows.filter(order=>selectedIds.includes(order.id));
 const fulfillmentInFlight=useRef(false);
 const [allocationVersions,setAllocationVersions]=useState<Record<string,number>>({});
 function refreshOpenAllocations(batchIds:string[]){
   setAllocationVersions(versions=>{
     const next={...versions};
     for(const batchId of new Set(batchIds))next[batchId]=(next[batchId]??0)+1;
     return next;
   });
 }
 const [offers,O]=useState<{batchId:string;open:boolean;closesAt:string|null;priceVnd:number;remainingKg:number;totalKg:number;heldKg:number;actualKg:number|null;harvestDate:string|null}[]>([]);
 const [zones,Z]=useState<{id:string;name:string}[]>([]),[drafts,D]=useState<{id:string;name:string;zoneId:string;startDate:string;expectedHarvestDate:string}[]>([]);
 async function publish(form:HTMLFormElement,d:(typeof drafts)[number]){
   const data=new FormData(form),priceVnd=Number(data.get('price')),totalKg=Number(data.get('kg'));
   const local=String(data.get('deadline')??'');
   const closesAt=local?new Date(local+':00+07:00').toISOString():null;
   const zone=zones.find(z=>z.id===d.zoneId)?.name??d.zoneId;
   if(!confirm([d.name+' · '+d.id,zone+' · '+formatCalendarDate(d.startDate)+' – '+formatCalendarDate(d.expectedHarvestDate),
     formatVnd(priceVnd)+'/kg · Nhận đặt trước '+formatKg(totalKg),closesAt?'Nhận đến '+formatDateTime(closesAt)+' (giờ Việt Nam)':'Không đặt hạn chốt','Công bố và mở bán trên chợ?'].join('\n')))return;
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
 async function load(n:number,id?:string,action?:string,offer?:{batchId:string;open?:boolean;priceVnd?:number;totalKg?:number;actualKg?:number;harvestDate?:string},nextFilters=filters){
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
     const query=new URLSearchParams({page:String(n),batch:nextFilters.batch,status:nextFilters.status});
     if(nextFilters.waiting)query.set('review','pending');
     if(nextFilters.orderId)query.set('orderId',nextFilters.orderId);
     if(nextFilters.fulfillment)query.set('fulfillment',nextFilters.fulfillment);
     const r=await fetch('/api/owner-orders?'+query,{headers,cache:'no-store'});
     if(!r.ok)throw Error(r.status===401?'Mã truy cập không hợp lệ.':'Không tải được danh sách.');
     const data=await r.json();setSelectedIds([]);setBulkNotice('');setFilters(nextFilters);setTotal(data.total);setFulfillmentCounts(data.fulfillmentCounts);setPendingCount(data.pendingCount);O(data.offers);Z(data.zones);D(data.drafts);R(data.orders);M(data.hasMore);P(data.page);if(id)S('Đã cập nhật đơn.');if(offer?.totalKg!==undefined)S('Đã cập nhật hạn mức của lô.');if(offer?.actualKg!==undefined)S('Đã chốt thu hoạch.');if(offer?.priceVnd)S('Đã cập nhật giá cho đơn mới.');
     return true;
   }catch(e){S(e instanceof Error?e.message:'Không kết nối được.');return false;}finally{B(false);}
 }
 async function markFulfillment(order:Order){
   if(busy||fulfillmentInFlight.current)return;
   const action=order.packedAt?'deliver':'pack';
   if(action==='deliver'&&!confirm('Xác nhận đơn này đã được giao cho khách?'))return;
   fulfillmentInFlight.current=true;
   B(true);S('');
   try{
     const query=new URLSearchParams({code:order.batchId,action:'fulfillment'});
     const response=await fetch('/api/allocation-preview?'+query,{
       method:'POST',
       headers:{authorization:'Bearer '+key,'Content-Type':'application/json'},
       body:JSON.stringify({id:order.id,action}),
     });
     if(!response.ok)throw Error('Không cập nhật được tiến độ. Hãy tải lại danh sách và thử lại.');
     refreshOpenAllocations([order.batchId]);
     const refreshed=await load(page);
     S(refreshed
       ? (action==='pack'?'Đã đánh dấu soạn hàng.':'Đã đánh dấu giao hàng.')
       : 'Đã lưu tiến độ. Hãy tải lại danh sách để xem trạng thái mới.');
   }catch(e){S(e instanceof Error?e.message:'Chưa xác nhận được tiến độ. Hãy tải lại danh sách.');}
   finally{fulfillmentInFlight.current=false;B(false);}
 }
 async function applyBulkFulfillment(){
   if(!bulkAction||!selectedRows.length||busy||fulfillmentInFlight.current)return;
   const label=bulkAction==='pack'?'đã soạn':'đã giao';
   if(!confirm(`Đánh dấu ${label} cho ${selectedRows.length} đơn đã chọn?`))return;
   fulfillmentInFlight.current=true;
   B(true);setBulkNotice('');
   try{
     const response=await fetch('/api/owner-orders?action=bulk-fulfillment',{
       method:'POST',
       headers:{authorization:'Bearer '+key,'Content-Type':'application/json'},
       body:JSON.stringify({ids:selectedRows.map(order=>order.id),action:bulkAction}),
     });
     if(response.status===409){
       setBulkNotice('Có đơn đã thay đổi hoặc không đủ điều kiện. Hãy tải lại danh sách để kiểm tra.');
       return;
     }
     if(!response.ok)throw Error();
     const result:{selected:number;updated:number}=await response.json();
     setSelectedIds([]);
     refreshOpenAllocations(selectedRows.map(order=>order.batchId));
     const refreshed=await load(page);
     setBulkNotice(refreshed
       ? `Đã cập nhật ${result.updated}/${result.selected} đơn.`+(result.updated<result.selected?' Các đơn còn lại đã ở trạng thái yêu cầu.':'')
       : 'Đã lưu tiến độ. Hãy tải lại danh sách để xem trạng thái mới.');
   }catch{setBulkNotice('Chưa xác nhận được kết quả. Hãy tải lại danh sách để kiểm tra.');}
   finally{fulfillmentInFlight.current=false;B(false);}
 }
 return <PageContainer><h1>Đơn đặt trước của trang trại</h1><form onSubmit={e=>{e.preventDefault();void load(1);}}>
 <TextField label="Mã truy cập chủ trang trại" type="password" required disabled={busy} value={key} onChange={e=>{K(e.target.value);R(null);setFilters(defaultFilters);}}/>
 <Button type="submit" disabled={busy}>Xem danh sách</Button></form><StatusMessage>{msg}</StatusMessage>
 {rows && <><h2>Tạo lô nháp</h2><form onSubmit={e=>{e.preventDefault();void createDraft(e.currentTarget);}}>
 <fieldset disabled={busy}><TextField label="Tên lô" name="name" required maxLength={120}/>
 <SelectField label="Vùng trồng" name="zoneId" required>{zones.map(z=><option key={z.id} value={z.id}>{z.name}</option>)}</SelectField>
 <TextField label="Ngày bắt đầu" type="date" name="startDate" required/>
 <TextField label="Dự kiến thu hoạch" type="date" name="expectedHarvestDate" required/><Button type="submit">Lưu lô nháp</Button></fieldset></form>
 <h2>Lô chưa công bố</h2>{drafts.length?<ul>{drafts.map(d=><li key={d.id}>{d.name} · {d.id} · {zones.find(z=>z.id===d.zoneId)?.name} · <CalendarDate value={d.startDate}/> – <CalendarDate value={d.expectedHarvestDate}/>
 <form onSubmit={e=>{e.preventDefault();void publish(e.currentTarget,d);}}><fieldset disabled={busy}><legend>Điều kiện mở bán</legend>
 <TextField label="Giá (₫/kg)" name="price" type="number" min="1" max="2147483647" step="1" required/>
 <TextField label="Hạn mức (kg)" name="kg" type="number" min="1" max="2147483647" step="1" required/>
 <TextField label="Nhận đơn đến (giờ Việt Nam, không bắt buộc)" type="datetime-local" name="deadline"/>
 <Button type="submit">Xem lại và mở bán</Button></fieldset></form></li>)}</ul>:<p>Chưa có lô nháp.</p>}
 <h2>Nhận đặt trước theo lô</h2>{offers.map(o=><Card as="section" key={o.batchId}><h3 className="record-id">Lô {o.batchId}</h3><p>Tổng hạn mức: {formatKg(o.totalKg)} · Đã giữ: {formatKg(o.heldKg)} · Còn nhận: {formatKg(o.harvestDate?0:o.remainingKg)} · {o.harvestDate?'Đã thu hoạch':o.closesAt&&Date.parse(o.closesAt)<=Date.now()?'Đã hết hạn':o.open?'Đang nhận đơn':'Đã tạm dừng'}</p>
 {o.actualKg!==null?<><p>Thực thu {formatKg(o.actualKg)} · {o.actualKg===o.heldKg?'Vừa đủ':o.actualKg<o.heldKg?'Thiếu '+formatKg(o.heldKg-o.actualKg):'Dư '+formatKg(o.actualKg-o.heldKg)} · <Button disabled={busy} onClick={()=>load(1,undefined,undefined,undefined,{...defaultFilters,batch:o.batchId,status:'active'})}>Xem đơn đang giữ</Button></p><AllocationPreview code={o.batchId} ownerKey={key} ownerBusy={busy}
   fulfillmentVersion={allocationVersions[o.batchId]??0}
   onReview={kind=>{
     void load(1,undefined,undefined,undefined,{
       ...defaultFilters,batch:o.batchId,status:kind==='pending'?'PENDING':'CONFIRMED',waiting:kind==='cancel',
     });
     document.getElementById('danh-sach-don')?.focus();
   }}/></>:<>
 <form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget),actualKg=Number(f.get('actual')),harvestDate=String(f.get('day'));
 if(confirm('Chốt thu hoạch '+formatKg(actualKg)+' ngày '+formatCalendarDate(harvestDate)+' và ngừng nhận đơn cho '+o.batchId+'?'))void load(page,undefined,undefined,{batchId:o.batchId,actualKg,harvestDate});}}>
 <TextField label="Ngày thực thu" type="date" name="day" required/><TextField label="Sản lượng thực thu (kg)" type="number" min="0" max="2147483647" step="1" name="actual" required/>
 <Button type="submit" disabled={busy}>Chốt thu hoạch</Button></form>
 <Button disabled={busy} onClick={()=>load(page,undefined,undefined,{batchId:o.batchId,open:!o.open})}>{o.open?'Tạm dừng nhận đơn':'Mở lại'}</Button>
 <form key={'cap'+o.totalKg} onSubmit={e=>{e.preventDefault();void load(page,undefined,undefined,{batchId:o.batchId,totalKg:Number(new FormData(e.currentTarget).get('capacity'))});}}>
 <TextField label="Tổng hạn mức mới (kg)" name="capacity" type="number" min={o.heldKg} max={2147483647} step={1} defaultValue={o.totalKg} required disabled={busy}/>
 <Button type="submit" disabled={busy}>Lưu hạn mức</Button></form>
 <form key={o.priceVnd} onSubmit={e=>{e.preventDefault();void load(page,undefined,undefined,{batchId:o.batchId,priceVnd:Number(new FormData(e.currentTarget).get('price'))});}}>
 <TextField label="Giá bán (₫/kg)" name="price" type="number" required min={1} max={2147483647} step={1} defaultValue={o.priceVnd} disabled={busy}/>
 <Button type="submit" disabled={busy}>Lưu giá</Button></form></>}</Card>)}<h2 id="danh-sach-don" tabIndex={-1}>Danh sách đơn</h2>
 <FulfillmentQueue counts={fulfillmentCounts} batch={filters.batch} active={filters.fulfillment} busy={busy}
   onSelect={fulfillment=>void load(1,undefined,undefined,undefined,{
     ...defaultFilters,batch:filters.batch,fulfillment:filters.fulfillment===fulfillment?'':fulfillment,
   })}/>
 <OwnerOrderFilters key={JSON.stringify(filters)} filters={filters} batchIds={offers.map(o=>o.batchId)}
   pendingCount={pendingCount} busy={busy}
   onApply={next=>void load(1,undefined,undefined,undefined,next)}/>
 {!rows.length ? <StatePanel title="Không tìm thấy đơn" description="Hãy đổi bộ lọc hoặc tìm theo mã đơn khác."/> :
   <p>Trang {page}/{Math.ceil(total/25)} · {total} đơn phù hợp</p>}
 {bulkAction && <BulkFulfillmentActions action={bulkAction} eligibleCount={eligibleRows.length}
   selectedCount={selectedRows.length} selectedKg={selectedRows.reduce((sum,order)=>sum+(order.allocatedKg??0),0)}
   busy={busy} notice={bulkNotice} onSelectAll={()=>setSelectedIds(eligibleRows.map(order=>order.id))}
   onClear={()=>setSelectedIds([])} onApply={()=>void applyBulkFulfillment()}/>}
 {rows.map(o=><Card key={o.id}><h3 className="record-id">Lô {o.batchId}</h3>
 {eligibleRows.includes(o) && <label className="action-row">
   <input type="checkbox" checked={selectedIds.includes(o.id)} disabled={busy}
     aria-label={`Chọn đơn ${o.id}`}
     onChange={e=>{
       const checked=e.target.checked;
       setSelectedIds(ids=>checked?[...ids,o.id]:ids.filter(id=>id!==o.id));
     }}/>
   Chọn đơn
 </label>}
 <p>Mã đơn: <span className="record-id">{o.id}</span></p>
 <p>{formatKg(o.kg)} · {formatVnd(o.kg*o.priceVnd)} · <OrderStatusBadge status={o.status}/> {o.cancelRequested?'· Khách yêu cầu hủy':o.cancelDecision==='APPROVED'?'· Đã duyệt hủy':o.cancelDecision==='DECLINED'?'· Đã từ chối yêu cầu hủy':''}</p>
 {o.offer.allocatedAt && o.allocatedKg!==null && <p>
   Được phân bổ: {formatKg(o.allocatedKg)} · {o.allocatedKg>0
     ? <FulfillmentStatus packedAt={o.packedAt} deliveredAt={o.deliveredAt}/>
     : 'Không có hàng để giao'}
 </p>}
 <div className="action-row">
 {o.offer.allocatedAt && (o.allocatedKg??0)>0 && !o.deliveredAt && (
   <Button disabled={busy} onClick={()=>void markFulfillment(o)}>{o.packedAt?'Đánh dấu đã giao':'Đánh dấu đã soạn'}</Button>
 )}
 {o.status==='PENDING'&&<Button disabled={busy} onClick={()=>load(page,o.id,'confirm')}>Xác nhận</Button>}
 {o.cancelRequested&&<><Button disabled={busy} onClick={()=>{if(confirm('Duyệt hủy và hoàn '+formatKg(o.kg)+'?'))void load(page,o.id,'approve-cancel');}}>Duyệt hủy</Button>
 <Button disabled={busy} onClick={()=>{if(confirm('Từ chối yêu cầu hủy và giữ nguyên đơn?'))void load(page,o.id,'decline-cancel');}}>Từ chối hủy</Button></>}
 {!o.offer.allocatedAt&&!o.cancelRequested&&!['CANCELLED','EXPIRED'].includes(o.status)&&<Button disabled={busy} onClick={()=>{if(confirm('Hủy đơn và hoàn '+formatKg(o.kg)+' cho lô?'))void load(page,o.id,'cancel');}}>Hủy đơn</Button>}</div></Card>)}
 {(page>1||more)&&<div className="action-row pagination-actions"><Button disabled={busy||page===1} onClick={()=>load(page-1)}>Trang trước</Button><Button disabled={busy||!more} onClick={()=>load(page+1)}>Trang sau</Button></div>}</>}
 </PageContainer>;
}
