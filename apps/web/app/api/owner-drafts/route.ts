export async function POST(req:Request){
 const r=await fetch((process.env.API_BASE_URL??'http://localhost:4000')+'/api/farms/demo/owner/orders/drafts',{
   method:'POST',headers:{authorization:req.headers.get('authorization')??'','Content-Type':'application/json'},
   body:await req.text(),signal:AbortSignal.timeout(6000)});
 return new Response(r.body,{status:r.status,headers:{'Cache-Control':'no-store','Content-Type':r.headers.get('content-type')??'text/plain'}});
}
