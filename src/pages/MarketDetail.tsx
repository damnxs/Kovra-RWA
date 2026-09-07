import { Link, useParams } from 'react-router-dom';
import { useMarket } from '../data/MarketProvider';
import { useWallet, shortAddress } from '../data/WalletProvider';
import { useWatchlist } from '../data/useWatchlist';
import { useOnchainFeed } from '../data/OnchainProvider';
import { formatPrice, formatTime, formatAgo, SESSION_LABEL } from '../lib/format';
import { PriceCell } from '../components/PriceCell';
import { ChangeLabel } from '../components/ChangeLabel';
import { DetailChart } from '../components/DetailChart';
import { Chip } from '../components/Chip';
import { StatusStrip } from '../components/StatusStrip';
import { StatePanel, SkeletonRows } from '../components/StatePanel';

const MODE_LABEL: Record<string, string> = {
  realtime: 'Real-time trade',
  delayed: 'Delayed',
  snapshot: 'Snapshot',
};

export function MarketDetail() {
  const { id = '' } = useParams();
  const { instruments, quotes, points, status, conn } = useMarket();
  const { address } = useWallet();
  const { has, toggle } = useWatchlist();
  const { stats } = useOnchainFeed();
  const inst = instruments.find((i) => i.id === id);
  const q = id ? quotes[id] : undefined;
  const poolStats = inst?.type === 'token' ? stats[inst.id] : undefined;

  if (!inst) {
    // Registry is static server-side; only an unknown id lands here.
    return (
      <div className="mx-auto max-w-content px-5 py-16 sm:px-8 lg:px-12">
        <StatePanel
          title="Unknown instrument"
          action={
            <Link
              to="/markets"
              className="flex h-11 items-center rounded-control border border-line bg-surface px-4 text-sm font-medium hover:border-ink"
            >
              All markets
            </Link>
          }
        >
          This instrument is not in Kovra's tracked universe.
        </StatePanel>
      </div>
    );
  }

  const loading = !status && conn === 'connecting';
  const watched = has(inst.id);

  return (
    <div className="mx-auto max-w-content px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
      <Link
        to="/markets"
        className="inline-flex h-11 items-center text-sm text-muted transition-colors hover:text-ink"
      >
        <span aria-hidden="true">←</span>&nbsp;All markets
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-[36px] leading-tight sm:text-[44px]">
            {inst.symbol} <span className="text-muted">· {inst.proxyLabel}</span>
          </h1>
          <p className="mt-1 text-muted">{inst.name}</p>
          <p className="mt-1 text-sm text-muted">
            {inst.type === 'token' ? 'Onchain token' : 'ETF'} · {inst.venue} · {inst.currency}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusStrip />
          {/* Relevant only once a wallet is connected — otherwise the dashboard has no account. */}
          {address && (
            <Link
              to="/dashboard"
              className="hidden h-11 items-center rounded-control px-3 text-sm text-muted transition-colors hover:text-ink sm:flex"
            >
              View in dashboard ({shortAddress(address)})
            </Link>
          )}
          <button
            type="button"
            aria-pressed={watched}
            aria-label={watched ? `Remove ${inst.symbol} from watchlist` : `Watch ${inst.symbol}`}
            onClick={() => toggle(inst.id, inst.symbol)}
            className={`h-11 rounded-control border px-4 text-sm font-medium transition-colors ${
              watched
                ? 'border-transparent bg-accent-soft text-ink'
                : 'border-line bg-surface text-muted hover:border-ink hover:text-ink'
            }`}
          >
            {watched ? 'Watching' : 'Watch'}
          </button>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          {status?.missingKey ? (
            <StatePanel title="Market data is unavailable">
              Prices for {inst.symbol} cannot be shown right now because the data service is not
              configured. The instrument information below remains accurate.
            </StatePanel>
          ) : loading ? (
            <>
              <p className="text-sm text-muted" role="status">
                Loading market data…
              </p>
              <div className="mt-3">
                <SkeletonRows rows={1} />
              </div>
            </>
          ) : (
            <div className="rounded-panel border border-line bg-surface p-5">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-[32px] font-medium leading-none">
                    <PriceCell price={q ? formatPrice(q.price) : null} />{' '}
                    <span className="text-base text-muted">{q?.currency ?? inst.currency}</span>
                  </p>
                  <p className="mt-2 flex items-center gap-3 text-sm">
                    {q ? (
                      <>
                        <ChangeLabel pct={q.changePct} />
                        <span className="tabular-nums text-muted">
                          vs prev close {formatPrice(q.previousClose)}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted">Awaiting first observation…</span>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {inst.type === 'token' ? (
                    <Chip tone="positive">Onchain 24/7</Chip>
                  ) : (
                    q && <Chip>{SESSION_LABEL[q.session] ?? 'Session unknown'}</Chip>
                  )}
                  {q && <Chip>{MODE_LABEL[q.mode] ?? q.mode}</Chip>}
                  {q?.stale && <Chip tone="warn">Stale</Chip>}
                </div>
              </div>

              {q && (
                <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-line pt-4 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-xs text-muted">Source (event time)</dt>
                    <dd className="tabular-nums mt-0.5">{formatTime(q.sourceTimestamp)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Received</dt>
                    <dd className="tabular-nums mt-0.5">{formatTime(q.receivedAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Freshness</dt>
                    <dd className="tabular-nums mt-0.5">{formatAgo(q.receivedAt) ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Provider</dt>
                    <dd className="mt-0.5 capitalize">{q.provider}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Server data path</dt>
                    <dd className="mt-0.5">
                      {inst.type === 'token'
                        ? 'Robinhood Chain node · live swaps'
                        : `${status?.transport === 'poll' ? 'Polling upstream' : 'Streaming upstream'} · page updates every 60s`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Delay</dt>
                    <dd className="tabular-nums mt-0.5">
                      {/* Delay is only meaningful for in-session quotes; a closed-market
                          snapshot's gap to the last session is not a data delay. */}
                      {q.delaySeconds === null || q.session !== 'open'
                        ? '—'
                        : `${q.delaySeconds}s from event time`}
                    </dd>
                  </div>
                </dl>
              )}
            </div>
          )}

          <div className="mt-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-medium">Price series</h2>
              {/* Only real period is since-connection; longer ranges need a historical
                  data plan and stay visibly unavailable rather than fake. */}
              <div className="flex rounded-control border border-line bg-surface p-0.5" role="group" aria-label="Chart period">
                <span className="flex h-11 items-center bg-accent px-3 text-sm font-medium" aria-current="true">
                  Since connection
                </span>
                {['1D', '1W', '1M'].map((p) => (
                  <button
                    key={p}
                    type="button"
                    disabled
                    title="Requires historical data access — not available on the current plan"
                    className="flex h-11 cursor-not-allowed items-center rounded-[5px] px-3 text-sm font-medium text-muted opacity-50"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <DetailChart points={points[inst.id]} />
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-panel border border-line bg-surface p-5">
            <h2 className="font-medium">What this instrument tracks</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{inst.description}</p>
            {inst.type === 'token' ? (
              <>
                <dl className="mt-3 space-y-2 border-t border-line pt-3 text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-xs text-muted">Contract (chainId 4663)</dt>
                    <dd className="tabular-nums font-medium">{shortAddress(inst.tokenAddress!)}</dd>
                  </div>
                  {poolStats && (
                    <>
                      <div className="flex items-baseline justify-between gap-2">
                        <dt className="text-xs text-muted">Pool swaps (since connect)</dt>
                        <dd className="tabular-nums">{poolStats.swaps.toLocaleString('en-US')}</dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-2">
                        <dt className="text-xs text-muted">Pool volume (since connect)</dt>
                        <dd className="tabular-nums">
                          ${Math.round(poolStats.volumeUsd).toLocaleString('en-US')}
                        </dd>
                      </div>
                    </>
                  )}
                </dl>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  The price above is this token&rsquo;s Uniswap pool price on Robinhood Chain — a
                  real onchain market price that can differ from any exchange listing. Contract
                  addresses are read directly onchain; verify independently before transacting.
                </p>
              </>
            ) : (
              <p className="mt-3 text-sm leading-relaxed text-muted">
                An ETF's price is its own share price on its exchange — not an index level. A future
                token linked to this ETF could also trade at a different executable price.
              </p>
            )}
          </div>
          <div className="rounded-panel border border-line bg-surface p-5">
            <h2 className="font-medium">Availability on Kovra</h2>
            <p className="mt-2 flex items-center gap-2 text-sm text-muted">
              <Chip>Not tradable on Kovra</Chip>
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {inst.symbol} is a reference instrument for market discovery. Buying, selling, and
              tokenized exposure are not available on Kovra today.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
