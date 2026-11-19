import { formatDateTime } from '../../lib/format';

export type FulfillmentTimes = { packedAt: string | null; deliveredAt: string | null };

export function FulfillmentStatus({ packedAt, deliveredAt }: FulfillmentTimes) {
  const latest = deliveredAt ?? packedAt;

  return (
    <>
      <strong>{deliveredAt ? 'Đã giao' : packedAt ? 'Đã soạn hàng' : 'Chờ soạn hàng'}</strong>
      {latest && <><br/><time dateTime={latest}>{formatDateTime(latest)}</time> (giờ Việt Nam)</>}
    </>
  );
}
