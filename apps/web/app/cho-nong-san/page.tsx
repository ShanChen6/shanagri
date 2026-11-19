import Link from 'next/link';
import { Button, PageContainer, SelectField, StatePanel, TextField } from '../../components/ui';
import StockRefresh from '../stock-refresh';
import { getCatalogPage, marketHref, readMarketQuery, type Lot } from './catalog';
import { LotCard } from './lot-card';

export const dynamic = 'force-dynamic';

async function fetchLots(sort: 'harvest' | 'price'): Promise<Lot[] | null> {
  const api = process.env.API_BASE_URL ?? 'http://localhost:4000';
  try {
    const response = await fetch(`${api}/api/public/market?sort=${sort}&includeSoldOut=1`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

export default async function Market({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = readMarketQuery(await searchParams);
  const allLots = await fetchLots(query.sort);
  const results = allLots && getCatalogPage(allLots, query);
  const hasFilters = Boolean(query.q || query.stock !== 'all' || query.sort !== 'harvest');

  return (
    <PageContainer>
      <StockRefresh/>
      <h1>Chợ nông sản</h1>
      <p><Link href="/tra-cuu-don">Tra cứu đơn đã đặt</Link></p>
      <p>Tìm lô nông sản và xem ngày thu hoạch dự kiến. Đây là chợ thử nghiệm, không thu tiền.</p>

      <form action="/cho-nong-san" method="get" aria-label="Tìm và lọc lô"
        className="market-filters" key={marketHref({ ...query, page: 1 })}>
        <TextField label="Tìm lô nông sản" name="q" type="search" maxLength={100} defaultValue={query.q}
          placeholder="Tên nông sản, mã lô hoặc trang trại"/>
        <SelectField label="Tình trạng nhận đơn" name="stock" defaultValue={query.stock}>
          <option value="all">Tất cả</option>
          <option value="available">Còn nhận đặt trước</option>
          <option value="sold-out">Đã hết số lượng</option>
        </SelectField>
        <SelectField label="Sắp xếp" name="sort" defaultValue={query.sort}>
          <option value="harvest">Thu hoạch sớm nhất</option>
          <option value="price">Giá thấp nhất</option>
        </SelectField>
        <div className="action-row">
          <Button type="submit">Áp dụng</Button>
          {hasFilters && <Link href="/cho-nong-san">Đặt lại</Link>}
        </div>
      </form>

      {!results ? (
        <StatePanel title="Không tải được danh sách lô" description="Vui lòng thử tải lại Chợ nông sản."
          actions={<a href={marketHref(query)}>Thử lại</a>}/>
      ) : results.total === 0 ? (
        <StatePanel
          title={query.q || query.stock !== 'all' ? 'Không tìm thấy lô phù hợp' : 'Chưa có lô nào trên chợ'}
          description={query.q || query.stock !== 'all'
            ? 'Hãy đổi từ khóa hoặc chọn tình trạng nhận đơn khác.'
            : 'Bạn có thể quay lại khi trang trại mở bán lô mới.'}
          actions={hasFilters && <Link href="/cho-nong-san">Xem tất cả lô</Link>}
        />
      ) : (
        <>
          <p>{results.total} lô{query.q && <> phù hợp với <strong>{query.q}</strong></>}</p>
          <div className="card-grid">
            {results.lots.map(lot => <LotCard key={lot.code} lot={lot}/>)}
          </div>
          {results.pageCount > 1 && (
            <nav aria-label="Phân trang lô" className="action-row pagination-actions">
              {results.page > 1 && <Link href={marketHref({ ...query, page: results.page - 1 })}>Trang trước</Link>}
              <span>Trang {results.page}/{results.pageCount}</span>
              {results.page < results.pageCount && <Link href={marketHref({ ...query, page: results.page + 1 })}>Trang sau</Link>}
            </nav>
          )}
        </>
      )}
    </PageContainer>
  );
}
