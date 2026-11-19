'use client';

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { FulfillmentStatus, type FulfillmentTimes } from '../../../components/orders/fulfillment-status';
import { formatDateTime, formatKg } from '../../../lib/format';
import { Button, DataTable, StatusMessage } from '../../../components/ui';

type Order = { cancelRequested: boolean; id: string; kg: number; createdAt: string };
type Plan = {
  version: string;
  allocatedAt: string | null;
  actualKg: number;
  remainingKg: number;
  confirmed: (Order & FulfillmentTimes & { proposedKg: number; missingKg: number })[];
  pending: Order[];
  summary: { requestedKg: number; assignedKg: number; missingKg: number };
  readiness: { canFinalize: boolean; cancellationCount: number };
};
type Props = {
  code: string;
  ownerKey: string;
  ownerBusy: boolean;
  fulfillmentVersion: number;
  onReview: (kind: 'pending' | 'cancel') => void;
};

export default function AllocationPreview({ code, ownerKey, ownerBusy, fulfillmentVersion, onReview }: Props) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [activity, setActivity] = useState<'loading' | 'finalizing' | 'exporting' | 'fulfillment' | null>(null);
  const [notice, setNotice] = useState('');
  const [confirmedVersion, setConfirmedVersion] = useState<string | null>(null);
  const inFlight = useRef(false);
  const endpoint = '/api/allocation-preview?code=' + encodeURIComponent(code);
  const headers = { authorization: 'Bearer ' + ownerKey };
  const busy = activity !== null || ownerBusy;
  const reviewing = plan !== null && confirmedVersion === plan.version && plan.readiness.canFinalize;
  const deliverable = plan?.allocatedAt ? plan.confirmed.filter(order => order.proposedKg > 0) : [];
  const packed = deliverable.filter(order => order.packedAt).length;
  const delivered = deliverable.filter(order => order.deliveredAt).length;

  async function readPlan() {
    const response = await fetch(endpoint, { headers, cache: 'no-store' });
    if (!response.ok) throw new Error('Không tải được phương án.');
    setPlan(await response.json());
  }

  async function refresh() {
    if (inFlight.current || ownerBusy) return;
    inFlight.current = true;
    setActivity('loading');
    setNotice('');
    setConfirmedVersion(null);
    try {
      await readPlan();
    } catch {
      setPlan(null);
      setNotice('Không tải được phương án. Vui lòng thử lại.');
    } finally {
      inFlight.current = false;
      setActivity(null);
    }
  }

  const syncedFulfillmentVersion = useRef(fulfillmentVersion);
  const refreshOpenPlan = useEffectEvent(() => {
    if (plan?.allocatedAt) void refresh();
  });

  useEffect(() => {
    if (busy || syncedFulfillmentVersion.current === fulfillmentVersion) return;
    syncedFulfillmentVersion.current = fulfillmentVersion;
    refreshOpenPlan();
  }, [busy, fulfillmentVersion]);

  async function finalize() {
    if (!plan || !reviewing || inFlight.current || ownerBusy) return;
    inFlight.current = true;
    setActivity('finalizing');
    setNotice('');
    setConfirmedVersion(null);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: plan.version,
          items: plan.confirmed.map(order => ({ id: order.id, kg: order.proposedKg })),
        }),
      });
      if (response.status === 409) {
        setPlan(null);
        setNotice('Phương án đã thay đổi hoặc đã chốt. Hãy mở lại bản xem trước.');
        return;
      }
      if (!response.ok) throw new Error('Không chốt được phương án.');
      setPlan(null);
      try {
        await readPlan();
        setNotice('Đã chốt phân bổ.');
      } catch {
        setNotice('Đã chốt phân bổ. Hãy mở lại bản xem trước để tải kết quả.');
      }
    } catch {
      setPlan(null);
      setNotice('Chưa xác nhận được kết quả. Hãy mở lại bản xem trước để kiểm tra.');
    } finally {
      inFlight.current = false;
      setActivity(null);
    }
  }

  async function updateFulfillment(id: string, action: 'pack' | 'deliver') {
    if (!plan?.allocatedAt || inFlight.current || ownerBusy) return;
    if (action === 'deliver' && !window.confirm('Xác nhận đơn này đã được giao cho khách?')) return;
    inFlight.current = true;
    setActivity('fulfillment');
    setNotice('');
    try {
      const response = await fetch(endpoint + '&action=fulfillment', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      if (!response.ok) throw new Error('Không cập nhật được tiến độ.');
      try {
        await readPlan();
        setNotice(action === 'pack' ? 'Đã đánh dấu soạn hàng.' : 'Đã đánh dấu giao hàng.');
      } catch {
        setNotice('Đã lưu tiến độ. Hãy cập nhật bản xem trước để tải trạng thái mới.');
      }
    } catch {
      setNotice('Chưa xác nhận được tiến độ. Hãy cập nhật bản xem trước rồi thử lại.');
    } finally {
      inFlight.current = false;
      setActivity(null);
    }
  }

  async function downloadPackingList() {
    if (!plan?.allocatedAt || inFlight.current || ownerBusy) return;
    inFlight.current = true;
    setActivity('exporting');
    setNotice('');
    try {
      const response = await fetch(endpoint + '&export=packing', { headers, cache: 'no-store' });
      if (!response.ok) throw new Error('Không tải được danh sách soạn hàng.');

      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `soan-hang-${code}.csv`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setNotice('Không tải được danh sách soạn hàng. Vui lòng thử lại.');
    } finally {
      inFlight.current = false;
      setActivity(null);
    }
  }

  return (
    <section>
      <Button disabled={busy} onClick={refresh}>
        {activity === 'loading' ? 'Đang tải…' : plan ? 'Cập nhật bản xem trước' : 'Xem trước phân bổ'}
      </Button>
      <StatusMessage>{notice}</StatusMessage>
      {plan && <>
        <h3 className="record-id">{plan.allocatedAt ? 'Phân bổ đã chốt' : 'Đề xuất phân bổ'} · {code}</h3>
        {plan.allocatedAt
          ? <p>Đã chốt lúc <time dateTime={plan.allocatedAt}>{formatDateTime(plan.allocatedAt)}</time> (giờ Việt Nam).</p>
          : <p>Phân bổ theo thời điểm đặt. Đơn đến trước được ưu tiên tối đa số lượng đã đặt.</p>}
        <dl className="allocation-summary">
          <div><dt>Thực thu</dt><dd>{formatKg(plan.actualKg)}</dd></div>
          <div><dt>Đã đặt (đơn đã xác nhận)</dt><dd>{formatKg(plan.summary.requestedKg)}</dd></div>
          <div><dt>{plan.allocatedAt ? 'Đã phân bổ' : 'Dự kiến giao'}</dt><dd>{formatKg(plan.summary.assignedKg)}</dd></div>
          <div><dt>Còn thiếu</dt><dd>{formatKg(plan.summary.missingKg)}</dd></div>
          <div><dt>Chưa phân bổ</dt><dd>{formatKg(plan.remainingKg)}</dd></div>
        </dl>
        {plan.allocatedAt && <p>Đã soạn {packed}/{deliverable.length} đơn · Đã giao {delivered}/{deliverable.length} đơn</p>}
        {plan.confirmed.length ? (
          <DataTable label={`Phân bổ lô ${code}`}>
            <thead><tr><th scope="col">Mã đơn</th><th scope="col">Thời điểm đặt (giờ Việt Nam)</th><th scope="col">Đã đặt</th>
              <th scope="col">{plan.allocatedAt ? 'Đã phân bổ' : 'Dự kiến giao'}</th><th scope="col">Thiếu</th>{plan.allocatedAt && <th scope="col">Tiến độ giao</th>}</tr></thead>
            <tbody>{plan.confirmed.map(order => (
              <tr key={order.id}>
                <th scope="row" className="record-id">{order.id}{order.cancelRequested && <><br/>Chờ duyệt hủy</>}</th>
                <td><time dateTime={order.createdAt}>{formatDateTime(order.createdAt)}</time></td>
                <td>{formatKg(order.kg)}</td><td>{formatKg(order.proposedKg)}</td><td>{formatKg(order.missingKg)}</td>
                {plan.allocatedAt && <td>{order.proposedKg === 0 ? 'Không có hàng để giao' : <>
                  <FulfillmentStatus packedAt={order.packedAt} deliveredAt={order.deliveredAt}/>
                  {!order.deliveredAt && (
                    <div className="action-row">
                      <Button disabled={busy} size="sm"
                        onClick={() => updateFulfillment(order.id, order.packedAt ? 'deliver' : 'pack')}>
                        {order.packedAt ? 'Đánh dấu đã giao' : 'Đánh dấu đã soạn'}
                      </Button>
                    </div>
                  )}
                </>}</td>}
              </tr>
            ))}</tbody>
          </DataTable>
        ) : <p>Chưa có đơn đã xác nhận.</p>}
        {!plan.allocatedAt && <>
          {!!plan.pending.length && <section>
            <h4>{plan.pending.length} đơn chờ xác nhận</h4>
            <ul>{plan.pending.map(order => (
              <li key={order.id}><span className="record-id">{order.id}</span> · {formatKg(order.kg)}</li>
            ))}</ul>
            <Button disabled={busy} onClick={() => onReview('pending')}>Xử lý đơn chờ xác nhận</Button>
          </section>}
          {plan.readiness.cancellationCount > 0 && <section>
            <h4>{plan.readiness.cancellationCount} yêu cầu hủy cần xử lý</h4>
            <Button disabled={busy} onClick={() => onReview('cancel')}>Xử lý yêu cầu hủy</Button>
          </section>}
          {!plan.readiness.canFinalize && <p>Cần có đơn đã xác nhận và xử lý hết đơn đang chờ hoặc yêu cầu hủy trước khi chốt.</p>}
          {reviewing && <p>
            Chốt giao {formatKg(plan.summary.assignedKg)} cho {plan.confirmed.length} đơn. Khách sẽ thấy kết quả trên trang tra cứu.
          </p>}
        </>}
        <div className="action-row pagination-actions">
          {reviewing ? <>
            <Button disabled={busy} onClick={finalize}>Xác nhận chốt phân bổ</Button>
            <Button disabled={busy} variant="quiet" onClick={() => setConfirmedVersion(null)}>Quay lại rà soát</Button>
          </> : !plan.allocatedAt && (
            <Button disabled={busy || !plan.readiness.canFinalize} onClick={() => setConfirmedVersion(plan.version)}>
              {activity === 'finalizing' ? 'Đang chốt phân bổ…' : 'Chốt phân bổ'}
            </Button>
          )}
          {plan.allocatedAt && plan.summary.assignedKg > 0 && (
            <Button disabled={busy} onClick={downloadPackingList}>
              {activity === 'exporting' ? 'Đang tải CSV…' : 'Tải danh sách soạn hàng (CSV)'}
            </Button>
          )}
          <Button disabled={busy} onClick={() => { setPlan(null); setConfirmedVersion(null); }}>Đóng bản xem trước</Button>
        </div>
      </>}
    </section>
  );
}
