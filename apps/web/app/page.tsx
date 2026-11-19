import { formatDateTime } from '../lib/format';
import { CalendarDate, Card, DataTable, PageContainer } from '../components/ui';
import History from "./history";
import Queue from "./queue";
import Controls from './controls';
export const dynamic = 'force-dynamic';
type Day = {rainMm:number; simulatedDate:string; moisturePct:number; needsWater:boolean};
type Zone = {virtualReadings:{moisturePct:number;observedAt:string}[];totalDays:number; simulatedDays:Day[];id:string; name:string; pump:{name:string}; plantProfile:{name:string; dryBelowPct:number}};
export default async function Home() {
  let zones: Zone[] | null = null;
  try {
    const response = await fetch((process.env.API_BASE_URL ?? 'http://localhost:4000')+'/api/farms/demo/zones',
      {cache:'no-store',signal:AbortSignal.timeout(4000)});
    if (response.ok) zones = await response.json();
  } catch { /* API unavailable */ }
  const count = zones?.length ? Math.min(...zones.map(z=>z.simulatedDays.length)) : 0;
  const total = zones?.[0]?.totalDays ?? 0;
  return <PageContainer><h1>Shanagri</h1><h2>Vùng trồng tại trang trại mẫu</h2>
    <p>Kịch bản nắng/mưa giả lập · Độ ẩm ban đầu 50%. {total > 0 && `Đã chạy ${count}/${total} ngày.`}</p>
    <Controls count={count} total={total}/>
    {zones === null ? <p>Không tải được vùng trồng. Vui lòng thử lại.</p> :
      zones.length === 0 ? <p>Chưa có vùng trồng.</p> : zones.map(z =>
        <Card as="section" key={z.id}><h3>{z.name}</h3><p>Giống cây: {z.plantProfile.name} · {z.pump.name}</p>
          {z.virtualReadings[0] && <p>Thiết bị ảo: {z.virtualReadings[0].moisturePct}% · <time dateTime={z.virtualReadings[0].observedAt}>{formatDateTime(z.virtualReadings[0].observedAt)}</time> (giờ Việt Nam)</p>}
          <p>Ngưỡng tưới mô phỏng: dưới {z.plantProfile.dryBelowPct}%</p>
          {z.simulatedDays[0] ? <p>Độ ẩm ước tính (mô phỏng): {z.simulatedDays[0].moisturePct}% · {z.simulatedDays[0].needsWater ? 'Cần tưới' : 'Chưa cần tưới'}</p> : <p>Độ ẩm ước tính: Chưa có dữ liệu</p>}
          {!!z.simulatedDays.length && <details><summary>Lịch sử độ ẩm ({z.simulatedDays.length} ngày)</summary>
            <DataTable label={`Lịch sử độ ẩm · ${z.name}`}><thead><tr><th>Ngày</th><th>Thời tiết mô phỏng</th><th>Độ ẩm ước tính</th><th>Nhu cầu tưới</th></tr></thead>
            <tbody>{z.simulatedDays.map(d=><tr key={d.simulatedDate}><td><CalendarDate value={d.simulatedDate}/></td>
            <td>{d.rainMm ? 'Mưa '+d.rainMm+' mm' : 'Nắng'}</td><td>{d.moisturePct}%</td><td>{d.needsWater?'Cần tưới':'Chưa cần tưới'}</td></tr>)}</tbody></DataTable></details>}</Card>)}
    <p><a href="/lo/CAM-2026-01">Xem nguồn gốc lô Cam Sành mẫu</a></p>
    <Queue/><History zones={(zones??[]).map(({id,name})=>({id,name}))}/>
  </PageContainer>;
}
