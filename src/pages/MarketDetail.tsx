import { Link, useParams } from 'react-router-dom';
import { LuArrowLeft } from 'react-icons/lu';
import { useMarket } from '../data/MarketProvider';
import { useWallet, shortAddress } from '../data/WalletProvider';
import { useWatchlist } from '../data/useWatchlist';
import { useOnchainFeed } from '../data/OnchainProvider';
import { formatPrice, formatTime, formatAgo } from '../lib/format';
import { PriceCell } from '../components/PriceCell';
import { ChangeLabel } from '../components/ChangeLabel';
import { DetailChart } from '../components/DetailChart';
import { Chip } from '../components/Chip';
import { StatusStrip } from '../components/StatusStrip';
import { StatePanel, SkeletonRows } from '../components/StatePanel';

export function MarketDetail() {
  const { id = '' } = useParams();
  const { instruments, quotes, points, status, conn } = useMarket();
  const { address } = useWallet();
  const { has, toggle } = useWatchlist();
  const { stats } = useOnchainFeed();
  const inst = instruments.find((i) => i.id === id);
  const q = id ? quotes[id] : undefined;
  const poolStats = inst ? stats[inst.id] : undefined;

  if (!inst) {
    // Registry is static server-side; only an unknown id lands here.
    return (
      <div className="mx-auto max-w-content px-5 py-16 sm:px-8 lg:px-12">
        <StatePanel
          title="Market not found"
          action={
            <Link
              to="/markets"
              className="flex h-11 items-center rounded-control border border-line bg-surface px-4 text-sm font-medium hover:border-ink"
            >
              All markets
            </Link>
          }
        >
          Kovra does not track this market.
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
        <LuArrowLeft aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
        All markets
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-[36px] leading-tight sm:text-[44px]">
            {inst.symbol} <span className="text-muted">· {inst.proxyLabel}</span>
          </h1>
          <p className="mt-1 text-muted">{inst.name}</p>
          <p className="mt-1 text-sm text-muted">
            Token on Robinhood Chain · {inst.venue} · {inst.currency}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusStrip />
          {/* Relevant only once a wallet is connected, otherwise the dashboard has no account. */}
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
          {loading ? (
            <>
              <p className="text-sm text-muted" role="status">
                Reading the pools…
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
                          vs previous close {formatPrice(q.previousClose)}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted">Waiting for the first swap…</span>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Chip tone="positive">Always open (24/7)</Chip>
                  {q?.stale && <Chip tone="warn">Delayed</Chip>}
                </div>
              </div>

              {q && (
                <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-line pt-4 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-xs text-muted">Price time (at the source)</dt>
                    <dd className="tabular-nums mt-0.5">{formatTime(q.sourceTimestamp)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Received</dt>
                    <dd className="tabular-nums mt-0.5">{formatTime(q.receivedAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Freshness</dt>
                    <dd className="tabular-nums mt-0.5">{formatAgo(q.receivedAt) ?? 'n/a'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Provider</dt>
                    <dd className="mt-0.5 capitalize">{q.provider}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">How Kovra gets it</dt>
                    <dd className="mt-0.5">Live swaps on Robinhood Chain</dd>
                  </div>
                </dl>
              )}
            </div>
          )}

          <div className="mt-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-medium">Price action</h2>
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
                    title="Historical data is not available on the current plan"
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
            <dl className="mt-3 space-y-2 border-t border-line pt-3 text-sm">
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-xs text-muted">Token contract (Robinhood Chain)</dt>
                <dd className="tabular-nums font-medium">{shortAddress(inst.tokenAddress)}</dd>
              </div>
              {poolStats && (
                <>
                  {poolStats.tvlUsd != null && (
                    <div className="flex items-baseline justify-between gap-2">
                      <dt className="text-xs text-muted">Pool value</dt>
                      <dd className="tabular-nums">
                        ${Math.round(poolStats.tvlUsd).toLocaleString('en-US')}
                      </dd>
                    </div>
                  )}
                  <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-xs text-muted">
                      Pool trades {poolStats.backfilled ? '(1h)' : '(since you connected)'}
                    </dt>
                    <dd className="tabular-nums">{poolStats.swaps.toLocaleString('en-US')}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-xs text-muted">
                      Traded volume {poolStats.backfilled ? '(1h)' : '(since you connected)'}
                    </dt>
                    <dd className="tabular-nums">
                      ${Math.round(poolStats.volumeUsd).toLocaleString('en-US')}
                    </dd>
                  </div>
                </>
              )}
            </dl>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              This price is struck by real trades in the token&rsquo;s Uniswap pool on Robinhood
              Chain, so it can differ from prices on legacy exchanges. Kovra reads it raw from the
              chain; verify it yourself before transacting.
            </p>
          </div>
          <div className="rounded-panel border border-line bg-surface p-5">
            <h2 className="font-medium">Availability on Kovra</h2>
            <p className="mt-2 flex items-center gap-2 text-sm text-muted">
              <Chip>Not tradable on Kovra</Chip>
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {inst.symbol} is listed for research only. Buying and selling are not available on
              Kovra today; the trade surface arrives with verified routes.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
