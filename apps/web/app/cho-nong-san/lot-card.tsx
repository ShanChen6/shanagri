import Link from 'next/link';
import { CalendarDate, Card } from '../../components/ui';
import { formatDateTime, formatKg, formatVnd } from '../../lib/format';
import type { Lot } from './catalog';

export function LotCard({ lot }: { lot: Lot }) {
  const href = `/lo/${encodeURIComponent(lot.code)}`;
  const available = lot.remainingKg > 0;

  return (
    <Card>
      <small className="record-id">{lot.farm} · {lot.code}</small>
      <h2>{lot.name}</h2>
      <strong>{formatVnd(lot.priceVnd)}/kg</strong>
      <p>Dự kiến thu hoạch: <CalendarDate value={lot.expectedHarvestDate}/></p>
      {lot.closesAt && (
        <p>Nhận đơn đến: <time dateTime={lot.closesAt}>{formatDateTime(lot.closesAt)}</time> (giờ Việt Nam)</p>
      )}
      <p>{available ? `Còn nhận: ${formatKg(lot.remainingKg)}` : 'Đã hết số lượng đặt trước'}</p>
      <div className="action-row">
        <Link href={href}>Truy xuất lô</Link>
        {available && <Link href={`${href}#dat-truoc`}>Đặt trước</Link>}
      </div>
    </Card>
  );
}
