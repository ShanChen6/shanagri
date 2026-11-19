import { statusPresentation, type OrderStatus } from '../../../components/orders/order-status-badge';
import { Button, SelectField, TextField } from '../../../components/ui';

export const fulfillmentLabels = {
  packing: 'Chờ soạn hàng',
  delivery: 'Chờ giao',
  delivered: 'Đã giao',
} as const;

export type FulfillmentFilter = keyof typeof fulfillmentLabels;
export type FulfillmentCounts = Record<FulfillmentFilter, number>;

export type OrderFilters = {
  batch: string;
  status: OrderStatus | 'all' | 'active';
  orderId: string;
  waiting: boolean;
  fulfillment: FulfillmentFilter | '';
};

export const defaultFilters: OrderFilters = { batch: '', status: 'all', orderId: '', waiting: false, fulfillment: '' };

type Props = {
  filters: OrderFilters;
  batchIds: string[];
  pendingCount: number;
  busy: boolean;
  onApply: (filters: OrderFilters) => void;
};

export function OwnerOrderFilters({ filters, batchIds, pendingCount, busy, onApply }: Props) {
  return (
    <form className="market-filters" aria-label="Lọc danh sách đơn"
      onSubmit={event => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        onApply({
          ...filters,
          batch: String(data.get('batch') ?? ''),
          status: data.get('status') as OrderFilters['status'],
          orderId: String(data.get('orderId') ?? '').trim(),
          fulfillment: data.get('fulfillment') as OrderFilters['fulfillment'],
        });
      }}>
      <TextField label="Mã đơn đầy đủ" name="orderId" type="search" maxLength={36}
        defaultValue={filters.orderId} disabled={busy}
        pattern="[a-fA-F0-9]{8}(?:-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12}"
        hint="Dán mã đơn từ trang tra cứu."/>
      <SelectField label="Lô nông sản" name="batch" defaultValue={filters.batch} disabled={busy}>
        <option value="">Tất cả lô</option>
        {batchIds.map(id => <option key={id} value={id}>{id}</option>)}
      </SelectField>
      <SelectField label="Trạng thái đơn" name="status" defaultValue={filters.status} disabled={busy}>
        <option value="all">Tất cả trạng thái</option>
        <option value="active">Đơn đang giữ</option>
        {Object.entries(statusPresentation).map(([value, { label }]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </SelectField>
      <SelectField label="Tiến độ soạn và giao" name="fulfillment" defaultValue={filters.fulfillment} disabled={busy}>
        <option value="">Tất cả tiến độ</option>
        {Object.entries(fulfillmentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </SelectField>
      <div className="action-row">
        <Button type="submit" disabled={busy}>Áp dụng bộ lọc</Button>
        <Button variant="quiet" disabled={busy} onClick={() => onApply(defaultFilters)}>Xóa bộ lọc</Button>
        <Button disabled={busy} aria-pressed={filters.waiting}
          onClick={() => onApply({ ...filters, waiting: !filters.waiting })}>
          Chờ duyệt hủy ({pendingCount})
        </Button>
      </div>
    </form>
  );
}
