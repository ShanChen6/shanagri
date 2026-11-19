export const dynamic = 'force-dynamic';
type Zone = {id:string; name:string; pump:{name:string}; plantProfile:{name:string; dryBelowPct:number}};
export default async function Home() {
  let zones: Zone[] | null = null;
  try {
    const response = await fetch((process.env.API_BASE_URL ?? 'http://localhost:4000')+'/api/farms/demo/zones',
      {cache:'no-store',signal:AbortSignal.timeout(4000)});
    if (response.ok) zones = await response.json();
  } catch { /* API unavailable */ }
  return <main><h1>Shanagri</h1><h2>Vùng trồng tại trang trại mẫu</h2>
    {zones === null ? <p>Không tải được vùng trồng. Vui lòng thử lại.</p> :
      zones.length === 0 ? <p>Chưa có vùng trồng.</p> : zones.map(z =>
        <section key={z.id}><h3>{z.name}</h3><p>Giống cây: {z.plantProfile.name} · {z.pump.name}</p>
          <p>Ngưỡng tưới mô phỏng: dưới {z.plantProfile.dryBelowPct}%</p>
          <p>Độ ẩm hiện tại: Chưa có dữ liệu</p></section>)}
  </main>;
}
