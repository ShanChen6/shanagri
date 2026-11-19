export async function GET(req:Request){
  const url=new URL('/api/farms/demo/irrigation-history',process.env.API_BASE_URL??'http://localhost:4000');
  const zone=new URL(req.url).searchParams.get('zoneId');
  if(zone)url.searchParams.set('zoneId',zone);
  try {
    const res=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(3000)});
    if(res.ok)return Response.json(await res.json(),{headers:{'Cache-Control':'no-store'}});
  }catch{}
  return Response.json({error:'Không tải được lịch sử'},{status:503});
}
