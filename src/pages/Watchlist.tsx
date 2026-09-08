import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMarket } from '../data/MarketProvider';
import { useWatchlist } from '../data/useWatchlist';
import { SearchField } from '../components/SearchField';
import { CategoryTabs } from '../components/CategoryTabs';
import { SortControls, type SortKey } from '../components/SortControls';
import { MarketRow } from '../components/MarketRow';
import { StatusStrip } from '../components/StatusStrip';

const LIST_ID = 'watchlist-list';
// Fixed per spec; categories without verified instruments simply match nothing
// rather than being populated with placeholder data.
const CATEGORIES = ['All', 'Technology', 'Energy', 'Financials', 'AI & Robotics', 'Healthcare'];

/**
 * Saved markets, the user's watchlist only. Persists locally and works before
 * wallet connection; the stored ids are the state a future wallet-sync migrates.
 */
export function Watchlist() {
  const { instruments, quotes, points } = useMarket();
  const { ids, has, toggle } = useWatchlist();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState<SortKey>('name');

  const saved = useMemo(
    () => instruments.filter((i) => ids.includes(i.id)),
    [instruments, ids],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = saved.filter((i) => {
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
  }, [saved, quotes, query, category, sort]);

  return (
    <div className="fade-in mx-auto max-w-content px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Saved markets</p>
          <h1 className="mt-3 font-serif text-[36px] leading-tight sm:text-[44px]">Watchlist.</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
            Your shortlist of the tape, kept in this browser, no wallet needed. It will be ready
            when watchlist sync arrives. Watching a market is not owning it.
          </p>
        </div>
        <StatusStrip />
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <SearchField value={query} onChange={setQuery} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CategoryTabs categories={CATEGORIES} selected={category} onSelect={setCategory} listId={LIST_ID} />
          <SortControls value={sort} onChange={setSort} />
        </div>
      </div>

      <div className="mt-4" id={LIST_ID} role="tabpanel" aria-label="Saved markets">
        {saved.length === 0 ? (
          <div className="rounded-panel border border-line bg-surface px-5 py-5">
            <p className="font-medium">Nothing on your watchlist yet</p>
            <p className="mt-1 max-w-lg text-sm leading-relaxed text-muted">
              Watch any market from the Markets page and it lands here with its live price, move
              and momentum.
            </p>
            <Link
              to="/markets"
              className="mt-4 inline-flex h-11 items-center rounded-control bg-ink px-4 text-sm font-medium text-white transition-opacity hover:opacity-85"
            >
              Explore markets
            </Link>
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-panel border border-line bg-surface px-5 py-5">
            <p className="font-medium">No saved markets match{query ? ` “${query.trim()}”` : ''}.</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Try a different search term or category.
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setCategory('All');
              }}
              className="mt-4 inline-flex h-11 items-center rounded-control border border-line bg-surface px-4 text-sm font-medium transition-colors hover:border-ink"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <ul className="rounded-panel border border-line bg-surface" aria-label="Saved market list">
            {rows.map((inst) => (
              <MarketRow
                key={inst.id}
                instrument={inst}
                quote={quotes[inst.id]}
                points={points[inst.id]}
                watched={has(inst.id)}
                onToggleWatch={toggle}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
