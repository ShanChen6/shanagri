async function proxy(req:Request){
  const url=new URL(req.url);
  const base=(process.env.API_BASE_URL??'http://localhost:4000')+'/api/farms/demo/owner/orders';
  let suffix='?page='+encodeURIComponent(url.searchParams.get('page')??'1');
  if(req.method==='POST'){
    const id=url.searchParams.get('id')??'',action=url.searchParams.get('action');
    if(!/^[a-f\d-]{36}$/i.test(id)||!['confirm','cancel'].includes(action??''))return new Response(null,{status:400});
    suffix='/'+id+'/'+action;
  }
  let body:string|undefined;
  if(req.method==='PUT'){
    const code=url.searchParams.get('code')??'';
    if(!/^[A-Za-z0-9_-]{1,100}$/.test(code))return new Response(null,{status:400});
    const data=await req.json().catch(()=>null);
    if(typeof data?.open!=='boolean')return new Response(null,{status:400});
    suffix='/offers/'+encodeURIComponent(code);body=JSON.stringify({open:data.open});
  }
  const r=await fetch(base+suffix,{method:req.method,body,headers:{'Content-Type':'application/json',authorization:req.headers.get('authorization')??''},cache:'no-store',signal:AbortSignal.timeout(6000)});
  return new Response(r.body,{status:r.status,headers:{'Cache-Control':'no-store','Content-Type':r.headers.get('content-type')??'text/plain'}});
}
export {proxy as GET,proxy as POST,proxy as PUT};
