import { useMarket } from '../data/MarketProvider';
import { useWatchlist } from '../data/useWatchlist';
import { concentration, biggestMove } from '../lib/agent';
import { formatPct } from '../lib/format';
import { Chip } from './Chip';

const EXAMPLE_WATCH = ['spy', 'qqq', 'xle'];

/**
 * Kovra Agent preview. Deterministic arithmetic only — no invented holdings,
 * news, confidence scores, or claims about the visitor's positions.
 */
export function AgentPreview() {
  const { instruments, quotes } = useMarket();
  const { ids } = useWatchlist();

  const usingExample = ids.length === 0;
  const sourceIds = usingExample ? EXAMPLE_WATCH : ids;
  const shares = concentration(sourceIds, instruments);
  const watchedCount = sourceIds.filter((id) => instruments.some((i) => i.id === id)).length;
  const move = biggestMove(quotes, instruments);

  return (
    <section aria-labelledby="agent-heading" className="rounded-panel border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 id="agent-heading" className="font-medium">
          Kovra Agent
        </h3>
        <Chip>Preview</Chip>
      </div>
      <p className="mt-1 text-xs text-muted">
        Deterministic analysis of the tracked universe — an autonomous agent is not yet integrated.
      </p>

      <div className="mt-4 rounded-control bg-page p-4">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium">Watchlist concentration</h4>
          {usingExample && <Chip tone="warn">Example</Chip>}
        </div>
        {shares.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            Watch instruments to see their category mix. In this example, watching SPY, QQQ, and XLE
            would mix broad market, technology, and energy exposure evenly.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {usingExample ? 'Hypothetical mix' : 'Your watched instruments'} span{' '}
              {shares.length} {shares.length === 1 ? 'category' : 'categories'} across{' '}
              {watchedCount} watched {watchedCount === 1 ? 'instrument' : 'instruments'}:
            </p>
            <ul className="mt-2 space-y-1.5">
              {shares.map(({ category, count, pct }) => (
                <li key={category} className="flex items-center gap-3 text-sm">
                  <span className="w-28 shrink-0 truncate text-muted">{category}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line" aria-hidden="true">
                    <span
                      className="block h-full rounded-full bg-ink"
                      style={{ width: `${Math.max(4, pct)}%` }}
                    />
                  </span>
                  <span className="tabular-nums w-24 shrink-0 text-right text-muted">
                    {pct}% ({count})
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="mt-3 rounded-control bg-page p-4">
        <h4 className="text-sm font-medium">Notable move</h4>
        {move ? (
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Among {instruments.length} tracked instruments, {move.instrument.symbol} moved most today (
            {formatPct(move.changePct)}). This is a market observation, not a recommendation.
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted">
            Notable moves appear once quote data is available.
          </p>
        )}
      </div>
    </section>
  );
}
