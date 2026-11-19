import StockRefresh from "../../stock-refresh";
import Order from "./order";
import {notFound} from 'next/navigation';
export const dynamic='force-dynamic';
type Trace={offer:{harvestDate:string|null;closesAt:string|null;remainingKg:number;priceVnd:number;open:boolean}|null;name:string;code:string;farm:string;zone:string;startDate:string;expectedHarvestDate:string;
  irrigations:{id:number;source:string;requestDay:string;completedAt:string;estimatedLiters:number|null}[];
  history:{simulatedDate:string;moisturePct:number;needsWater:boolean}[]};
const date=(iso:string)=>iso.slice(0,10).split('-').reverse().join('/');
export default async function BatchPage({params}:{params:Promise<{code:string}>}){
  const {code}=await params;
  const res=await fetch((process.env.API_BASE_URL??'http://localhost:4000')+'/api/public/batches/'+encodeURIComponent(code),
    {cache:'no-store',signal:AbortSignal.timeout(5000)});
  if(res.status===404) notFound();
  if(!res.ok)throw Error('Không tải được thông tin lô');
  const b:Trace=await res.json();
  const expired=!!b.offer?.closesAt && Date.parse(b.offer.closesAt)<=Date.now();
  return <main><a href="/cho-nong-san">Chợ nông sản</a><StockRefresh/><h1>{b.name}</h1><p>Mã lô: {b.code} · {b.farm} · {b.zone}</p>
    <p>Bắt đầu: {date(b.startDate)} · Dự kiến thu hoạch: {date(b.expectedHarvestDate)}</p>
    {b.offer?.closesAt && <p>Nhận đơn đến: {new Date(b.offer.closesAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})} (giờ Việt Nam)</p>}
    {expired && <p>Lô đã hết hạn nhận đặt trước.</p>}
    {!expired && b.offer?.open && <div id="dat-truoc"><Order code={b.code} price={b.offer.priceVnd} remaining={b.offer.remainingKg}/></div>}
    {b.offer?.harvestDate && <p>Ngày thu hoạch thực tế (chủ trại ghi nhận): {date(b.offer.harvestDate)}</p>}
    {b.offer && !b.offer.harvestDate && !b.offer.open && <p>Lô đang tạm dừng nhận đặt trước.</p>}
    <h2>Nhật ký độ ẩm mô phỏng</h2><p>Dữ liệu ước tính từ kịch bản thời tiết giả lập.</p>
    {!b.history.length?<p>Chưa có ngày mô phỏng cho lô này.</p>:
    <table><thead><tr><th>Ngày</th><th>Độ ẩm ước tính</th><th>Nhu cầu tưới</th></tr></thead>
    <tbody>{b.history.map(d=><tr key={d.simulatedDate}><td>{date(d.simulatedDate)}</td><td>{d.moisturePct}%</td>
    <td>{d.needsWater?'Cần tưới':'Chưa cần tưới'}</td></tr>)}</tbody></table>}
    <h2>Lượt tưới đã hoàn tất</h2>
    {b.irrigations.length===0?<p>Chưa ghi nhận lượt tưới hoàn tất cho lô này.</p>:
    <table><thead><tr><th>Ngày yêu cầu (mô phỏng)</th><th>Hoàn tất (giờ Việt Nam)</th><th>Yêu cầu</th><th>Nước ước tính</th></tr></thead>
    <tbody>{b.irrigations.map(r=><tr key={r.id}><td>{date(r.requestDay)}</td>
    <td>{new Date(r.completedAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}</td>
    <td>{r.source==='AUTO'?'Tự động':'Thủ công'}</td><td>{r.estimatedLiters===null?'Chưa có dữ liệu':r.estimatedLiters+' L'}</td></tr>)}</tbody></table>}</main>;
}
