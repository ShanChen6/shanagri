'use client';
import { Button, StatusMessage } from '../components/ui';
import { useState,useEffect,useRef,useCallback } from 'react';
import { changeSimulation } from './actions';
export default function Controls({count,total}:{count:number;total:number}) {
  const [auto,setAuto]=useState(false), [busy,setBusy]=useState(false), [error,setError]=useState('');
  const active=useRef(false);
  const change=useCallback(async(day:number|'reset')=>{
    if(active.current) return;
    active.current=true; setBusy(true); setError('');
    try {
      if(!await changeSimulation(day)) throw new Error();
    } catch {
      setAuto(false); setError('Không cập nhật được mô phỏng. Hãy thử lại.');
    } finally { active.current=false; setBusy(false); }
  },[]);
  useEffect(()=>{
    if(!auto || busy) return;
    if(count>=total){setAuto(false);return;}
    const timer=setTimeout(()=>void change(count+1),1000);
    return ()=>clearTimeout(timer);
  },[auto,busy,count,total,change]);
  return <div>
    <Button disabled={auto||busy||count>=total} onClick={()=>void change(count+1)}>Chạy ngày {Math.min(count+1,total)||1}</Button>{' '}
    <Button disabled={!auto && (busy||count>=total)} onClick={()=>setAuto(v=>!v)}>{auto?'Tạm dừng':'Chạy tự động'}</Button>{' '}
    <Button disabled={auto||busy||!count} onClick={()=>{if(window.confirm('Xóa hàng đợi tưới và lịch sử mô phỏng của trang trại mẫu và trở về ngày 0?')) void change('reset');}}>Đặt lại</Button>
    <StatusMessage>{error || (total && count===total?'Đã hoàn tất mô phỏng.':auto?'Đang chạy tự động…':busy?'Đang cập nhật…':'')}</StatusMessage>
  </div>;
}
