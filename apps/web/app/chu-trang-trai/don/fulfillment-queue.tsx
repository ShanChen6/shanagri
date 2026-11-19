import { Button } from '../../../components/ui';
import { fulfillmentLabels, type FulfillmentCounts, type FulfillmentFilter } from './order-filters';

const milestones = ['packing', 'delivery', 'delivered'] as const;

export function FulfillmentQueue({ counts, batch, active, busy, onSelect }: {
  counts: FulfillmentCounts;
  batch: string;
  active: FulfillmentFilter | '';
  busy: boolean;
  onSelect: (filter: FulfillmentFilter) => void;
}) {
  return (
    <section className="fulfillment-queue" aria-labelledby="fulfillment-title">
      <h3 id="fulfillment-title">Hàng đợi soạn và giao</h3>
      <p>{batch ? <>Đơn có hàng của lô <span className="record-id">{batch}</span></> : 'Đơn có hàng của tất cả lô'}</p>
      <div className="action-row">
        {milestones.map(filter => (
          <Button key={filter} disabled={busy} aria-pressed={active === filter} onClick={() => onSelect(filter)}>
            {fulfillmentLabels[filter]} ({counts[filter]})
          </Button>
        ))}
      </div>
    </section>
  );
}
