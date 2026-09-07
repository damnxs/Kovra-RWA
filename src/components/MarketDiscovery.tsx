import { useMemo, useState } from 'react';
import { useMarket } from '../data/MarketProvider';
import { SearchField } from './SearchField';
import { CategoryTabs } from './CategoryTabs';
import { SortControls, type SortKey } from './SortControls';
import { MarketRow } from './MarketRow';
import { StatusStrip } from './StatusStrip';
import { StatePanel, SkeletonRows } from './StatePanel';

const LIST_ID = 'market-list';

/** Search + category tabs + sorting + instrument rows. Owns its filter state. */
export function MarketDiscovery({
  heading = 'Market discovery',
  headingLevel = 'h2',
}: {
  heading?: string;
  headingLevel?: 'h1' | 'h2';
}) {
  const { instruments, quotes, points, status, conn } = useMarket();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState<SortKey>('name');

  const categories = useMemo(
    () => ['All', ...new Set(instruments.map((i) => i.category))],
    [instruments],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = instruments.filter((i) => {
      const inCategory = category === 'All' || i.category === category;
      const inQuery =
        q === '' || i.symbol.toLowerCase().includes(q) || i.name.toLowerCase().includes(q);
      return inCategory && inQuery;
    });
    return filtered.sort((a, b) => {
      if (sort === 'name') return a.symbol.localeCompare(b.symbol);
      const ca = quotes[a.id]?.changePct ?? -Infinity;
      const cb = quotes[b.id]?.changePct ?? -Infinity;
      if (ca !== cb) return cb - ca;
      return a.symbol.localeCompare(b.symbol);
    });
  }, [instruments, quotes, query, category, sort]);

  const loading = !status && conn === 'connecting';
  const filteredOut = !loading && rows.length === 0;
  const Heading = headingLevel;

  return (
    <section id="markets" aria-labelledby="markets-heading" className="scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Heading id="markets-heading" className="font-serif text-[32px] leading-tight sm:text-4xl">
            {heading}
          </Heading>
          <p className="mt-1 text-sm text-muted">
            {instruments.length} tracked instruments · ETF reference proxies + real onchain tokens on
            Robinhood Chain · not tradable on Kovra
          </p>
        </div>
        <StatusStrip refresh={false} />
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <SearchField value={query} onChange={setQuery} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CategoryTabs categories={categories} selected={category} onSelect={setCategory} listId={LIST_ID} />
          <SortControls value={sort} onChange={setSort} />
        </div>
      </div>

      <div className="mt-4" id={LIST_ID} role="tabpanel" aria-label="Instruments">
        {status?.missingKey && (
          <StatePanel title="Market data is unavailable">
            Prices cannot be shown right now because the data service is not configured. Instruments
            and categories below remain accurate and browsable — check back later for quotes.
          </StatePanel>
        )}
        {loading ? (
          <>
            <p className="text-sm text-muted" role="status">
              Loading market data…
            </p>
            <div className="mt-3">
              <SkeletonRows rows={5} />
            </div>
          </>
        ) : filteredOut ? (
          <StatePanel
            title={`No instruments match${query ? ` “${query.trim()}”` : ''}.`}
            action={
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setCategory('All');
                }}
                className="h-11 rounded-control border border-line bg-surface px-4 text-sm font-medium transition-colors hover:border-ink"
              >
                Clear filters
              </button>
            }
          >
            Try a different search term or category.
          </StatePanel>
        ) : (
          <ul
            className={`rounded-panel border border-line bg-surface${status?.missingKey ? ' mt-4' : ''}`}
            aria-label="Instrument list"
          >
            {rows.map((inst) => (
              <MarketRow
                key={inst.id}
                instrument={inst}
                quote={quotes[inst.id]}
                points={points[inst.id]}
                action="trade"
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
