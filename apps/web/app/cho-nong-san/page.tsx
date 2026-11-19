import Link from 'next/link';
export const dynamic='force-dynamic';
type Lot={code:string;name:string;farm:string;priceVnd:number;remainingKg:number;expectedHarvestDate:string};
export default async function Market({searchParams}:{searchParams:Promise<{sort?:string}>}){
  const sort=(await searchParams).sort==='price'?'price':'harvest';
  let lots:Lot[]|null=null;
  try{
    const r=await fetch((process.env.API_BASE_URL??'http://localhost:4000')+'/api/public/market?sort='+sort,
      {cache:'no-store',signal:AbortSignal.timeout(5000)});
    if(r.ok)lots=await r.json();
  }catch{}
  return <main style={{maxWidth:'68rem',margin:'2rem auto',padding:'0 1rem'}}>
    <h1>Chợ nông sản</h1><p>Chọn lô theo giá và ngày thu hoạch dự kiến. Đây là chợ thử nghiệm, không thu tiền.</p>
    <nav aria-label="Sắp xếp lô">Sắp xếp: <Link aria-current={sort==='harvest'?'page':undefined} href="?sort=harvest">Thu hoạch sớm nhất</Link> · <Link aria-current={sort==='price'?'page':undefined} href="?sort=price">Giá thấp nhất</Link></nav>
    {lots===null?<p>Không tải được chợ. <a href={'?sort='+sort}>Thử lại</a></p>:!lots.length?<p>Hiện chưa có lô nhận đặt trước.</p>:
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,16rem),1fr))',gap:'1rem',marginTop:'1rem'}}>
    {lots.map(l=>{const href='/lo/'+encodeURIComponent(l.code);return <article key={l.code} style={{border:'1px solid #bfd2c5',borderRadius:12,padding:'1rem'}}>
      <small>{l.farm} · {l.code}</small><h2>{l.name}</h2><strong>{l.priceVnd.toLocaleString('vi-VN')} ₫/kg</strong>
      <p>Dự kiến thu hoạch: <time dateTime={l.expectedHarvestDate.slice(0,10)}>{l.expectedHarvestDate.slice(0,10).split('-').reverse().join('/')}</time></p>
      <p>Còn nhận: {l.remainingKg} kg</p><Link href={href}>Truy xuất lô</Link> · <Link href={href+'#dat-truoc'}>Đặt trước</Link>
    </article>})}</div>}</main>;
}
