import { revalidatePath } from 'next/cache';
export const dynamic = 'force-dynamic';
type Day = {simulatedDate:string; moisturePct:number; needsWater:boolean};
type Zone = {simulatedDays:Day[];id:string; name:string; pump:{name:string}; plantProfile:{name:string; dryBelowPct:number}};
async function runDay() {
  'use server';
  const resp = await fetch((process.env.API_BASE_URL ?? 'http://localhost:4000')+'/api/farms/demo/simulation/day-one',{method:'POST',signal:AbortSignal.timeout(8000)});
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
  return <main><h1>Shanagri</h1><h2>Vùng trồng tại trang trại mẫu</h2>
    <p>Kịch bản ngày 01/01/2026: không mưa, độ ẩm ban đầu 50%, giảm 5 điểm phần trăm.</p>
    <form action={runDay}><button disabled={!zones?.length}>Chạy mô phỏng ngày đầu</button></form>
    {zones === null ? <p>Không tải được vùng trồng. Vui lòng thử lại.</p> :
      zones.length === 0 ? <p>Chưa có vùng trồng.</p> : zones.map(z =>
        <section key={z.id}><h3>{z.name}</h3><p>Giống cây: {z.plantProfile.name} · {z.pump.name}</p>
          <p>Ngưỡng tưới mô phỏng: dưới {z.plantProfile.dryBelowPct}%</p>
          {z.simulatedDays[0] ? <p>Độ ẩm ước tính (mô phỏng): {z.simulatedDays[0].moisturePct}% · {z.simulatedDays[0].needsWater ? 'Cần tưới' : 'Chưa cần tưới'}</p> : <p>Độ ẩm ước tính: Chưa có dữ liệu</p>}</section>)}
  </main>;
}
