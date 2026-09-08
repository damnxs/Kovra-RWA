import { useMarket } from '../data/MarketProvider';
import { formatAgo } from '../lib/format';

/**
 * Truthful refresh label for the 60-second model: "Updating…" with a pulsing
 * dot while a round-trip is in flight, otherwise "Auto-updated every minute"
 * plus the age of the last successful update. Never says "Live".
 */
export function RefreshStatus() {
  const { refreshing, lastUpdatedAt, conn } = useMarket();
  const ago = formatAgo(lastUpdatedAt ? new Date(lastUpdatedAt).toISOString() : null);

  if (conn === 'error') return null; // StatusStrip owns the error state

  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted">
      <span
        aria-hidden="true"
        className={`h-2 w-2 rounded-full ${refreshing ? 'animate-pulse bg-ink' : 'bg-line'}`}
      />
      <span className="tabular-nums">
        {refreshing
          ? 'Updating…'
          : ago
            ? `Updated every minute · ${ago.toLowerCase().replace(/^updated /, '')}`
            : 'Updated every minute'}
      </span>
    </span>
  );
}
