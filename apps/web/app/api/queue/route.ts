export async function GET(){
  try {
    const res=await fetch((process.env.API_BASE_URL??'http://localhost:4000')+'/api/farms/demo/queue',{cache:'no-store',signal:AbortSignal.timeout(3000)});
    if(res.ok) return Response.json(await res.json(),{headers:{'Cache-Control':'no-store'}});
  } catch {}
  return Response.json({error:'Không tải được hàng đợi'},{status:503});
}
