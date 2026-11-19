import { Button, StatusMessage } from '../../../components/ui';
import { formatKg } from '../../../lib/format';

export function BulkFulfillmentActions({
  action, eligibleCount, selectedCount, selectedKg, busy, notice, onSelectAll, onClear, onApply,
}: {
  action: 'pack' | 'deliver';
  eligibleCount: number;
  selectedCount: number;
  selectedKg: number;
  busy: boolean;
  notice: string;
  onSelectAll: () => void;
  onClear: () => void;
  onApply: () => void;
}) {
  return (
    <section className="fulfillment-queue" aria-label="Xử lý nhiều đơn">
      <p>Đã chọn {selectedCount}/{eligibleCount} đơn trên trang này · {formatKg(selectedKg)}</p>
      <div className="action-row">
        <Button variant="quiet" disabled={busy || selectedCount === eligibleCount} onClick={onSelectAll}>
          Chọn tất cả trên trang
        </Button>
        <Button variant="quiet" disabled={busy || !selectedCount} onClick={onClear}>Bỏ chọn</Button>
        <Button disabled={busy || !selectedCount} onClick={onApply}>
          {action === 'pack' ? 'Đánh dấu đã soạn các đơn đã chọn' : 'Đánh dấu đã giao các đơn đã chọn'}
        </Button>
      </div>
      <StatusMessage>{notice}</StatusMessage>
    </section>
  );
}
