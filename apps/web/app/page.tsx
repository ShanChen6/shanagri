import { revalidatePath } from 'next/cache';
export const dynamic = 'force-dynamic';
type Day = {rainMm:number; simulatedDate:string; moisturePct:number; needsWater:boolean};
type Zone = {totalDays:number; simulatedDays:Day[];id:string; name:string; pump:{name:string}; plantProfile:{name:string; dryBelowPct:number}};
async function runDay(data:FormData) {
  'use server';
  const resp = await fetch((process.env.API_BASE_URL ?? 'http://localhost:4000')+'/api/farms/demo/simulation/days/'+Number(data.get('day')),{method:'POST',signal:AbortSignal.timeout(8000)});
  if (!resp.ok) throw new Error('Không chạy được mô phỏng');
  revalidatePath('/');
}
export default async function Home() {
  let zones: Zone[] | null = null;
  try {
    const response = await fetch((process.env.API_BASE_URL ?? 'http://localhost:4000')+'/api/farms/demo/zones',
      {cache:'no-store',signal:AbortSignal.timeout(4000)});
    if (response.ok) zones = await response.json();
  } catch { /* API unavailable */ }
  const count = zones?.length ? Math.min(...zones.map(z=>z.simulatedDays.length)) : 0;
  const total = zones?.[0]?.totalDays ?? 0;
  return <main><h1>Shanagri</h1><h2>Vùng trồng tại trang trại mẫu</h2>
    <p>Kịch bản nắng/mưa giả lập · Độ ẩm ban đầu 50%. {total > 0 && `Đã chạy ${count}/${total} ngày.`}</p>
    <form action={runDay}><input type="hidden" name="day" value={count+1}/><button disabled={!total || count>=total}>{total && count>=total ? 'Đã hoàn tất mô phỏng' : 'Chạy ngày '+(count+1)}</button></form>
    {zones === null ? <p>Không tải được vùng trồng. Vui lòng thử lại.</p> :
      zones.length === 0 ? <p>Chưa có vùng trồng.</p> : zones.map(z =>
        <section key={z.id}><h3>{z.name}</h3><p>Giống cây: {z.plantProfile.name} · {z.pump.name}</p>
          <p>Ngưỡng tưới mô phỏng: dưới {z.plantProfile.dryBelowPct}%</p>
          {z.simulatedDays[0] ? <p>Độ ẩm ước tính (mô phỏng): {z.simulatedDays[0].moisturePct}% · {z.simulatedDays[0].needsWater ? 'Cần tưới' : 'Chưa cần tưới'}</p> : <p>Độ ẩm ước tính: Chưa có dữ liệu</p>}
          {!!z.simulatedDays.length && <details><summary>Lịch sử độ ẩm ({z.simulatedDays.length} ngày)</summary>
            <table><thead><tr><th>Ngày</th><th>Thời tiết mô phỏng</th><th>Độ ẩm ước tính</th><th>Nhu cầu tưới</th></tr></thead>
            <tbody>{z.simulatedDays.map(d=><tr key={d.simulatedDate}><td>{d.simulatedDate.slice(0,10).split('-').reverse().join('/')}</td>
            <td>{d.rainMm ? 'Mưa '+d.rainMm+' mm' : 'Nắng'}</td><td>{d.moisturePct}%</td><td>{d.needsWater?'Cần tưới':'Chưa cần tưới'}</td></tr>)}</tbody></table></details>}</section>)}
  </main>;
}
