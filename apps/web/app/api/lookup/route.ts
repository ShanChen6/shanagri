export async function GET(req:Request){
 const r=await fetch((process.env.API_BASE_URL??'http://localhost:4000')+'/api/public/order-lookup',{headers:{authorization:req.headers.get('authorization')??''},cache:'no-store',signal:AbortSignal.timeout(6000)});
 return new Response(r.body,{status:r.status,headers:{'Content-Type':r.headers.get('content-type')??'text/plain','Cache-Control':'no-store'}});
}
export async function POST(req:Request){
 const action=new URL(req.url).searchParams.get('action');
 if(!action||!['verify','resend','cancel'].includes(action))return new Response(null,{status:400});
 const r=await fetch((process.env.API_BASE_URL??'http://localhost:4000')+'/api/public/hold/'+action,{method:'POST',headers:{authorization:req.headers.get('authorization')??'','Content-Type':'application/json'},body:await req.text(),signal:AbortSignal.timeout(8000)});
 return new Response(r.body,{status:r.status,headers:{'Cache-Control':'no-store'}});
}
