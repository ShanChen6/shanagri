async function proxy(req:Request){
  const url=new URL(req.url);
  const base=(process.env.API_BASE_URL??'http://localhost:4000')+'/api/farms/demo/owner/orders';
  const filters=new URLSearchParams();
  for(const name of ['page','batch','review','status','orderId','fulfillment']){
    for(const value of url.searchParams.getAll(name))filters.append(name,value);
  }
  let suffix='?'+filters.toString();
  let body:string|undefined;
  if(req.method==='POST'){
    const id=url.searchParams.get('id')??'',action=url.searchParams.get('action');
    if(action==='bulk-fulfillment'){
      suffix='/fulfillment/bulk';
      body=await req.text();
    }else{
      if(!/^[a-f\d-]{36}$/i.test(id)||!['confirm','cancel','approve-cancel','decline-cancel'].includes(action??''))return new Response(null,{status:400});
      suffix='/'+id+'/'+action;
    }
  }
  if(req.method==='PUT'){
    const code=url.searchParams.get('code')??'';
    if(!/^[A-Za-z0-9_-]{1,100}$/.test(code))return new Response(null,{status:400});
    const data=await req.json().catch(()=>null);
    if(typeof data?.open!=='boolean' && !Number.isInteger(data?.priceVnd) && !Number.isInteger(data?.totalKg) && !Number.isInteger(data?.actualKg))return new Response(null,{status:400});
    suffix='/offers/'+encodeURIComponent(code);body=JSON.stringify({open:data.open,priceVnd:data.priceVnd,totalKg:data.totalKg,actualKg:data.actualKg,harvestDate:data.harvestDate});
  }
  const r=await fetch(base+suffix,{method:req.method,body,headers:{'Content-Type':'application/json',authorization:req.headers.get('authorization')??''},cache:'no-store',signal:AbortSignal.timeout(6000)});
  return new Response(r.body,{status:r.status,headers:{'Cache-Control':'no-store','Content-Type':r.headers.get('content-type')??'text/plain'}});
}
export {proxy as GET,proxy as POST,proxy as PUT};
