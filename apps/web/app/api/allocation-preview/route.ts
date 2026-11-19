export async function GET(req:Request){
 const code=new URL(req.url).searchParams.get('code')??'';
 if(!/^[a-z0-9_-]{1,100}$/i.test(code))return new Response(null,{status:400});
 const r=await fetch((process.env.API_BASE_URL??'http://localhost:4000')+'/api/farms/demo/owner/orders/offers/'+code+'/allocation-preview',
   {headers:{authorization:req.headers.get('authorization')??''},cache:'no-store',signal:AbortSignal.timeout(6000)});
 return new Response(r.body,{status:r.status,headers:{'Content-Type':r.headers.get('content-type')??'text/plain','Cache-Control':'no-store'}});
}
