export type Lot = {
  closesAt: string | null;
  code: string;
  name: string;
  farm: string;
  priceVnd: number;
  remainingKg: number;
  expectedHarvestDate: string;
};

type SearchParams = Record<string, string | string[] | undefined>;
export type MarketQuery = ReturnType<typeof readMarketQuery>;

export function readMarketQuery(params: SearchParams) {
  const q = typeof params.q === 'string' ? params.q.trim().slice(0, 100) : '';
  const sort = params.sort === 'price' ? 'price' : 'harvest';
  const stock = params.stock === 'available' || params.stock === 'sold-out' ? params.stock : 'all';
  const requestedPage = typeof params.page === 'string' && /^[1-9]\d*$/.test(params.page)
    ? Number(params.page)
    : 1;
  const page = Number.isSafeInteger(requestedPage) ? requestedPage : 1;

  return { q, sort, stock, page } as const;
}

export function marketHref({ q, sort, stock, page }: MarketQuery) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (sort !== 'harvest') params.set('sort', sort);
  if (stock !== 'all') params.set('stock', stock);
  if (page > 1) params.set('page', String(page));
  const search = params.toString();

  return search ? `/cho-nong-san?${search}` : '/cho-nong-san';
}

function normalizeSearch(value: string) {
  return value.toLocaleLowerCase('vi-VN').normalize('NFD')
    .replace(/\p{M}/gu, '').replace(/đ/g, 'd');
}

const pageSize = 12;

export function getCatalogPage(lots: Lot[], query: MarketQuery) {
  const terms = normalizeSearch(query.q).split(/\s+/).filter(Boolean);
  const matching = lots.filter(lot => {
    if (query.stock === 'available' && lot.remainingKg <= 0) return false;
    if (query.stock === 'sold-out' && lot.remainingKg > 0) return false;
    if (!terms.length) return true;

    const searchable = normalizeSearch(`${lot.name} ${lot.code} ${lot.farm}`);
    return terms.every(term => searchable.includes(term));
  });
  const pageCount = Math.max(1, Math.ceil(matching.length / pageSize));
  const page = Math.min(query.page, pageCount);
  const start = (page - 1) * pageSize;

  return { lots: matching.slice(start, start + pageSize), total: matching.length, page, pageCount };
}
