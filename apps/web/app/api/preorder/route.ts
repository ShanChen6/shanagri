export async function POST(req:Request){
  const {code,id,kg}=await req.json();
  const res=await fetch((process.env.API_BASE_URL??'http://localhost:4000')+'/api/public/batches/'+encodeURIComponent(code)+'/preorders',
    {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,kg}),signal:AbortSignal.timeout(5000)});
  return new Response(await res.text(),{status:res.status,headers:{'Content-Type':res.headers.get('content-type')??'text/plain'}});
}
