async function proxy(req:Request){
 const params=new URL(req.url).searchParams;
 const code=params.get('code')??'';
 if(!/^[a-z0-9_-]{1,100}$/i.test(code))return new Response(null,{status:400});
 const endpoint=req.method==='POST'
   ? (params.get('action')==='fulfillment'?'/fulfillment':'/allocation')
   : (params.get('export')==='packing'?'/packing-list':'/allocation-preview');
 const r=await fetch((process.env.API_BASE_URL??'http://localhost:4000')+'/api/farms/demo/owner/orders/offers/'+code+endpoint,
   {method:req.method,body:req.method==='POST'?await req.text():undefined,headers:{'Content-Type':'application/json',authorization:req.headers.get('authorization')??''},cache:'no-store',signal:AbortSignal.timeout(6000)});
 const headers=new Headers({'Content-Type':r.headers.get('content-type')??'text/plain','Cache-Control':'no-store'});
 const disposition=r.headers.get('content-disposition');
 if(disposition)headers.set('Content-Disposition',disposition);
 return new Response(r.body,{status:r.status,headers});
}

export {proxy as GET,proxy as POST};
