export const statusPresentation = {
  HOLD: { label: 'Chờ xác minh điện thoại', tone: 'waiting' },
  EXPIRED: { label: 'Đã hết hạn giữ chỗ', tone: 'closed' },
  PENDING: { label: 'Chờ xác nhận', tone: 'waiting' },
  CONFIRMED: { label: 'Đã xác nhận', tone: 'confirmed' },
  CANCELLED: { label: 'Đã hủy', tone: 'closed' },
} as const;

export type OrderStatus = keyof typeof statusPresentation;

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { label, tone } = statusPresentation[status];

  return <span className={`order-status order-status-${tone}`}>{label}</span>;
}
