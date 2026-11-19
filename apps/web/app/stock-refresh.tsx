'use client';
import {useEffect} from 'react';
import {useRouter} from 'next/navigation';

// Keep open market tabs current; a reservation still checks the locked offer.
export default function StockRefresh(){
 const router=useRouter();
 useEffect(()=>{
   const refresh=()=>{if(document.visibilityState==='visible')router.refresh();};
   const timer=setInterval(refresh,10000);
   document.addEventListener('visibilitychange',refresh);
   return ()=>{clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};
 },[router]);
 return null;
}
