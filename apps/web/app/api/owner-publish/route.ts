export async function POST(req:Request){
 const data=await req.json().catch(()=>null);
 if(typeof data?.code!=='string'||!/^LO-[a-f0-9-]{36}$/i.test(data.code))return Response.json({error:'Mã lô không hợp lệ.'},{status:400});
 const r=await fetch((process.env.API_BASE_URL??'http://localhost:4000')+'/api/farms/demo/owner/orders/drafts/'+data.code+'/publish',{
   method:'POST',headers:{authorization:req.headers.get('authorization')??'','Content-Type':'application/json'},
   body:JSON.stringify({priceVnd:data.priceVnd,totalKg:data.totalKg}),signal:AbortSignal.timeout(6000)});
 return new Response(r.body,{status:r.status,headers:{'Cache-Control':'no-store','Content-Type':r.headers.get('content-type')??'text/plain'}});
}
