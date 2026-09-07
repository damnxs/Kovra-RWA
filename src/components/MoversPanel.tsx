import { Link } from 'react-router-dom';
import { useMarket } from '../data/MarketProvider';
import { movers } from '../lib/agent';
import { formatPrice } from '../lib/format';
import { ChangeLabel } from './ChangeLabel';

/** Today's movers within the explicitly stated tracked universe. */
export function MoversPanel() {
  const { instruments, quotes } = useMarket();
  const { gainers, losers, unavailable } = movers(quotes, instruments);
  const hasData = gainers.length > 0 || losers.length > 0;

  return (
    <section aria-labelledby="movers-heading" className="rounded-panel border border-line bg-surface p-5">
      <h3 id="movers-heading" className="font-medium">
        Today's movers
      </h3>
      <p className="mt-1 text-xs text-muted">of {instruments.length} tracked instruments</p>
      {!hasData ? (
        <p className="mt-4 text-sm text-muted">Changes appear once quote data is available.</p>
      ) : (
        // Single column: a two-col split inside this one-third-width panel clipped
        // prices mid-digit — prices must never be the element that truncates.
        <div className="mt-4 space-y-2">
          <div>
            <p className="px-1 text-xs text-muted">Up today</p>
            {gainers.slice(0, 3).map(({ instrument, changePct }) => (
              <Link
                key={instrument.id}
                to={`/markets/${instrument.id}`}
                className="flex items-baseline justify-between gap-3 rounded-control px-1 py-2.5 transition-colors hover:bg-page"
              >
                <span className="truncate text-sm">
                  <span className="font-medium">{instrument.symbol}</span>{' '}
                  <span className="tabular-nums text-muted">
                    {formatPrice(quotes[instrument.id]?.price ?? null)}
                  </span>
                </span>
                <ChangeLabel pct={changePct} word={false} />
              </Link>
            ))}
            {gainers.length === 0 && <p className="px-1 py-2.5 text-sm text-muted">None today</p>}
          </div>
          <div>
            <p className="px-1 text-xs text-muted">Down today</p>
            {losers.slice(0, 3).map(({ instrument, changePct }) => (
              <Link
                key={instrument.id}
                to={`/markets/${instrument.id}`}
                className="flex items-baseline justify-between gap-3 rounded-control px-1 py-2.5 transition-colors hover:bg-page"
              >
                <span className="truncate text-sm">
                  <span className="font-medium">{instrument.symbol}</span>{' '}
                  <span className="tabular-nums text-muted">
                    {formatPrice(quotes[instrument.id]?.price ?? null)}
                  </span>
                </span>
                <ChangeLabel pct={changePct} word={false} />
              </Link>
            ))}
            {losers.length === 0 && <p className="px-1 py-2.5 text-sm text-muted">None today</p>}
          </div>
        </div>
      )}
      {unavailable.length > 0 && (
        <p className="mt-3 text-xs text-muted">
          No change shown for {unavailable.map((i) => i.symbol).join(', ')} — previous close not yet
          available.
        </p>
      )}
    </section>
  );
}
