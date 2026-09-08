import { useMarket } from '../data/MarketProvider';
import { Chip } from './Chip';
import { RefreshStatus } from './RefreshStatus';

/**
 * Service-state chips shown wherever quotes render: chain-node state and
 * connection. "Live" is never shown, the client refreshes on a 60-second
 * cycle by design.
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
  if (status && !status.chain.connected) {
    chips.push({
      key: 'chain',
      node: <Chip tone="warn">Chain connection lost, showing last known prices</Chip>,
    });
  }
  if (conn === 'error') {
    chips.push({
      key: 'conn',
      node: (
        <Chip tone="warn">
          <span>Connection lost, showing last known data</span>
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
