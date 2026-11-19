export async function GET(req:Request){
 const r=await fetch((process.env.API_BASE_URL??'http://localhost:4000')+'/api/public/order-lookup',{headers:{authorization:req.headers.get('authorization')??''},cache:'no-store',signal:AbortSignal.timeout(6000)});
 return new Response(r.body,{status:r.status,headers:{'Content-Type':r.headers.get('content-type')??'text/plain','Cache-Control':'no-store'}});
}
