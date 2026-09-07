import { Link } from 'react-router-dom';
import { useMarket } from '../data/MarketProvider';
import { useWatchlist } from '../data/useWatchlist';
import { formatPrice } from '../lib/format';
import { ChangeLabel } from './ChangeLabel';

/** Watched instruments — local only, clearly not owned exposure. */
export function WatchlistPanel() {
  const { instruments, quotes } = useMarket();
  const { ids } = useWatchlist();
  const watched = instruments.filter((i) => ids.includes(i.id));

  return (
    <section aria-labelledby="watchlist-heading" className="rounded-panel border border-line bg-surface p-5">
      <h3 id="watchlist-heading" className="font-medium">
        Watched instruments
      </h3>
      <p className="mt-1 text-xs text-muted">Saved locally — not owned exposure</p>
      {watched.length === 0 ? (
        <div className="mt-4">
          <p className="text-sm text-muted">You are not watching any instruments yet.</p>
          <Link
            to="/markets"
            className="mt-3 inline-flex h-11 items-center rounded-control border border-line bg-surface px-4 text-sm font-medium transition-colors hover:border-ink"
          >
            Browse markets
          </Link>
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {watched.map((inst) => {
            const q = quotes[inst.id];
            return (
              <li key={inst.id}>
                <Link
                  to={`/markets/${inst.id}`}
                  className="flex items-baseline justify-between gap-3 rounded-control px-1 py-2.5 transition-colors hover:bg-page"
                >
                  <span className="truncate text-sm">
                    <span className="font-medium">{inst.symbol}</span>{' '}
                    <span className="text-muted">{inst.category}</span>
                  </span>
                  <span className="flex items-baseline gap-3">
                    <span className="tabular-nums text-sm text-muted">
                      {formatPrice(q?.price ?? null)}
                    </span>
                    <ChangeLabel pct={q?.changePct ?? null} word={false} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
