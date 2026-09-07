import { useMemo, useState } from 'react';
import { useActivity, type ActivityEvent, type ActivitySource } from '../data/activity';
import { useOnchainFeed } from '../data/OnchainProvider';
import { formatTime } from '../lib/format';

const FILTERS: Array<{ key: 'all' | ActivitySource; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'wallet', label: 'Wallet' },
  { key: 'watchlist', label: 'Watchlist' },
  { key: 'onchain', label: 'Onchain' },
];

const KIND_LABEL: Record<ActivityEvent['kind'], string> = {
  'wallet-connected': 'Wallet connected',
  'wallet-disconnected': 'Wallet disconnected',
  'watchlist-added': 'Added to watchlist',
  'watchlist-removed': 'Removed from watchlist',
  'asset-detected': 'Supported asset detected',
  'onchain-transfer': 'Verified onchain transfer',
};

/** One merged row: either a local action or a real onchain event from the live feed. */
type Row =
  | { src: 'local'; at: string; e: ActivityEvent }
  | { src: 'onchain'; at: string; symbol: string; amount: string; usdValue: number | null; txHash: string };

/**
 * Verified history — real events only. Wallet and watchlist actions are local
 * records; the Onchain filter is a live feed of real ERC-20 transfers of
 * supported tokens on Robinhood Chain, streamed from the Kovra server's own
 * chain connection. Nothing is ever shown as sample data.
 */
export function Activity() {
  const events = useActivity();
  const { events: onchain, connected } = useOnchainFeed();
  const [filter, setFilter] = useState<'all' | ActivitySource>('all');

  const rows = useMemo<Row[]>(() => {
    const local = events.map((e) => ({ src: 'local' as const, at: e.at, e }));
    const chain: Row[] = onchain.map((e) => ({
      src: 'onchain' as const,
      at: e.at,
      symbol: e.symbol,
      amount: e.amount,
      usdValue: e.usdValue,
      txHash: e.txHash,
    }));
    if (filter === 'onchain') return chain;
    if (filter === 'wallet') return local.filter((r) => r.e.source === 'wallet');
    if (filter === 'watchlist') return local.filter((r) => r.e.source === 'watchlist');
    return [...local, ...chain].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 150);
  }, [events, onchain, filter]);

  return (
    <div className="fade-in mx-auto max-w-content px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
      <p className="eyebrow">Verified history</p>
      <h1 className="mt-3 font-serif text-[36px] leading-tight sm:text-[44px]">Activity.</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
        Account and onchain events, newest first. Wallet and watchlist actions are recorded locally
        in this browser. Onchain events are real ERC-20 transfers of supported tokens on Robinhood
        Chain, streamed live — nothing is ever displayed as example data.
      </p>

      <div className="mt-6 flex flex-wrap gap-1" role="group" aria-label="Activity filters">
        {FILTERS.map(({ key, label }) => {
          const active = key === filter;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(key)}
              className={`flex h-11 shrink-0 items-center rounded-control px-4 text-sm font-medium transition-colors ${
                active ? 'bg-accent text-ink' : 'text-muted hover:bg-accent-soft/60 hover:text-ink'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        {rows.length === 0 ? (
          filter === 'onchain' ? (
            <EmptyState
              title={connected === false ? 'Chain feed offline' : 'Waiting for onchain transfers…'}
              body={
                connected === false
                  ? 'The server could not reach Robinhood Chain — live transfers resume when the connection recovers.'
                  : 'Real transfers of supported tokens appear here the moment they are confirmed on Robinhood Chain.'
              }
            />
          ) : events.length === 0 ? (
            <EmptyState
              title="No activity yet"
              body="Connecting a wallet or changing your watchlist records those actions here. They are stored locally in this browser."
            />
          ) : (
            <EmptyState title={`No ${filter} events yet`} body="Try another filter to see recorded activity." />
          )
        ) : (
          <ol className="rounded-panel border border-line bg-surface" aria-label="Activity list">
            {rows.map((r, i) => (
              <li
                key={r.src === 'local' ? r.e.id : `${r.txHash}-${i}`}
                className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 border-b border-line px-4 py-4 last:border-b-0 sm:grid-cols-[150px_1fr_110px_120px] sm:px-5"
              >
                <p className="tabular-nums text-xs text-muted sm:text-sm">{formatTime(r.at)}</p>
                {r.src === 'local' ? (
                  <>
                    <p className="min-w-0 text-sm">
                      <span className="font-medium">{KIND_LABEL[r.e.kind]}</span>
                      {r.e.symbol && <span className="text-muted"> · {r.e.symbol}</span>}
                    </p>
                    <p className="col-span-2 text-xs text-muted sm:col-span-1 sm:text-right sm:text-sm">
                      {r.e.value ?? '—'}
                    </p>
                    <p className="col-span-2 text-xs sm:col-span-1 sm:text-right">
                      <span className="text-muted">Local record</span>
                    </p>
                  </>
                ) : (
                  <>
                    <p className="min-w-0 text-sm">
                      <span className="font-medium">Onchain transfer</span>
                      <span className="text-muted"> · {r.symbol}</span>
                      <span className="text-muted"> · {r.usdValue !== null ? `≈ $${r.usdValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : 'value pending price'}</span>
                    </p>
                    <p className="col-span-2 text-xs tabular-nums text-muted sm:col-span-1 sm:text-right sm:text-sm">
                      {r.amount}
                    </p>
                    <p className="col-span-2 text-xs sm:col-span-1 sm:text-right">
                      <span className="tabular-nums font-medium">Tx {r.txHash.slice(0, 10)}…</span>
                    </p>
                  </>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-panel border border-line bg-surface px-5 py-5">
      <p className="font-medium">{title}</p>
      <p className="mt-1 max-w-lg text-sm leading-relaxed text-muted">{body}</p>
    </div>
  );
}
