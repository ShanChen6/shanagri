'use server';
import { revalidatePath } from 'next/cache';
export async function changeSimulation(day:number|'reset') {
  if(day!=='reset' && (!Number.isInteger(day)||day<1||day>30)) return false;
  try {
    const path = day==='reset'?'reset':'days/'+day;
    const res = await fetch((process.env.API_BASE_URL??'http://localhost:4000')+'/api/farms/demo/simulation/'+path,
      {method:'POST',signal:AbortSignal.timeout(8000)});
    revalidatePath('/');
    return res.ok;
  } catch { return false; }
}
