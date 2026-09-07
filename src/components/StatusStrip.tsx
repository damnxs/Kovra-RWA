import { useMarket } from '../data/MarketProvider';
import { Chip } from './Chip';
import { RefreshStatus } from './RefreshStatus';

function rateLimited(status: { rateLimitedUntil: string | null } | null): boolean {
  return !!status?.rateLimitedUntil && Date.parse(status.rateLimitedUntil) > Date.now();
}

/**
 * Service-state chips shown wherever quotes render: refresh model, demo,
 * rate limit, auth, connection. "Live" is never shown — the client refreshes
 * on a 60-second cycle by design.
 */
export function StatusStrip({ refresh = true }: { refresh?: boolean }) {
  const { status, conn, retry } = useMarket();
  const chips: Array<{ key: string; node: React.ReactNode }> = [];

  if (refresh) {
    chips.push({
      key: 'refresh',
      node: (
        <Chip>
          <RefreshStatus />
        </Chip>
      ),
    });
  }
  if (status?.upstreamError === 'auth-rejected') {
    chips.push({
      key: 'auth',
      node: <Chip tone="warn">Data source rejected credentials</Chip>,
    });
  }
  if (status?.demo) {
    chips.push({
      key: 'demo',
      node: <Chip tone="warn">Simulated data — not real prices</Chip>,
    });
  }
  if (rateLimited(status)) {
    chips.push({
      key: 'ratelimit',
      node: <Chip tone="warn">Rate limited — retrying</Chip>,
    });
  }
  if (conn === 'error') {
    chips.push({
      key: 'conn',
      node: (
        <Chip tone="warn">
          <span>Connection lost — showing last known data</span>
          <button
            type="button"
            onClick={retry}
            className="rounded-control border border-line bg-surface px-2 text-xs font-medium text-ink hover:border-ink"
          >
            Retry
          </button>
        </Chip>
      ),
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map(({ key, node }) => (
        <span key={key}>{node}</span>
      ))}
    </div>
  );
}
