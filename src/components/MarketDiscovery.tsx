import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LuArrowRight } from 'react-icons/lu';
import { useMarket } from '../data/MarketProvider';
import { useOnchainFeed } from '../data/OnchainProvider';
import type { Instrument, OnchainStats, Quote } from '../types/quote';
import { formatPrice, formatUsdCompact } from '../lib/format';
import { PriceCell } from './PriceCell';
import { ChangeLabel } from './ChangeLabel';
import { StatePanel, SkeletonRows } from './StatePanel';

/**
 * The real Uniswap market table: live pool price, pool value (real token
 * balances), and real swap volume and trade counts accumulated since the
 * server connected. Rows restream in place as quotes and stats push in.
 */

type PoolSort = 'volume' | 'tvl' | 'price';

const SORTS: Array<{ key: PoolSort; label: string }> = [
  { key: 'volume', label: 'Volume' },
  { key: 'tvl', label: 'Pool value' },
  { key: 'price', label: 'Price' },
];

// Shared column tracks so the header row and data rows always align:
// identity, price, change (stacked below sm via display:contents), then
// pool value / trades appear as columns at lg, actions last.
const GRID =
  'grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 sm:grid-cols-[minmax(0,1fr)_120px_116px_104px_auto] sm:px-5 lg:grid-cols-[minmax(0,1fr)_120px_116px_104px_88px_104px_auto]';

type PoolStat = OnchainStats[string];

function priceOf(q: Quote | undefined): number {
  const n = Number(q?.price);
  return Number.isFinite(n) ? n : -1;
}

/** Trade + details links. Display class is passed in so each breakpoint mounts exactly one copy. */
function RowActions({ inst, className = '' }: { inst: Instrument; className?: string }) {
  return (
    <div className={`items-center justify-end gap-1 ${className}`}>
      <Link
        to={`/trade/${inst.id}`}
        aria-label={`Trade ${inst.symbol}`}
        className="flex h-11 items-center rounded-control border border-line bg-surface px-3.5 text-sm font-medium text-ink transition-colors hover:border-ink"
      >
        Trade
      </Link>
      <Link
        to={`/markets/${inst.id}`}
        aria-label={`View details for ${inst.symbol}`}
        className="flex h-11 w-11 items-center justify-center rounded-control text-muted transition-colors hover:bg-accent-soft hover:text-ink"
      >
        <LuArrowRight aria-hidden="true" className="h-4 w-4" />
      </Link>
    </div>
  );
}

function PoolRow({ inst, quote, stat }: { inst: Instrument; quote?: Quote; stat?: PoolStat }) {
  const compact = [
    `Pool ${stat ? formatUsdCompact(stat.tvlUsd) : 'n/a'}`,
    `${stat ? stat.swaps.toLocaleString('en-US') : 'n/a'} trades`,
    `${stat ? formatUsdCompact(stat.volumeUsd) : 'n/a'} traded`,
  ].join(' · ');

  return (
    <li className="border-b border-line last:border-b-0">
      <div className={`grid ${GRID} py-3.5 transition-colors hover:bg-page sm:py-4`}>
        {/* Identity: the symbol links to the detail page. */}
        <div className="min-w-0">
          <Link to={`/markets/${inst.id}`} className="group block">
            <p className="flex items-baseline gap-2">
              <span className="text-[15px] font-semibold group-hover:underline group-hover:decoration-line group-hover:underline-offset-4">
                {inst.symbol}
              </span>
              <span className="truncate text-sm text-muted">{inst.name}</span>
            </p>
          </Link>
        </div>

        {/* Price and change: one stacked cell on mobile, two columns from sm up. */}
        <div className="flex flex-col items-end gap-0.5 sm:contents">
          <div className="text-right text-[15px] font-medium">
            {quote ? (
              <>
                <PriceCell price={formatPrice(quote.price)} />{' '}
                <span className="text-xs font-normal text-muted">{quote.currency}</span>
              </>
            ) : (
              <span className="text-sm font-normal text-muted">n/a</span>
            )}
          </div>
          <div className="text-right text-sm">
            <ChangeLabel pct={quote?.changePct} />
          </div>
        </div>

        <div
          className={`hidden text-right text-sm tabular-nums lg:block ${
            stat?.tvlUsd == null ? 'text-muted' : ''
          }`}
        >
          {formatUsdCompact(stat?.tvlUsd)}
        </div>
        <div className="hidden text-right text-sm tabular-nums lg:block">
          {stat ? (
            stat.swaps.toLocaleString('en-US')
          ) : (
            <span className="text-muted">n/a</span>
          )}
        </div>
        <div className="hidden text-right text-sm font-medium tabular-nums sm:block">
          {stat ? (
            formatUsdCompact(stat.volumeUsd)
          ) : (
            <span className="font-normal text-muted">n/a</span>
          )}
        </div>

        <RowActions inst={inst} className="hidden sm:flex" />

        {/* Below lg the pool columns collapse into one muted line; below sm it also carries the actions. */}
        <div className="col-span-2 mt-1 flex flex-wrap items-center justify-between gap-2 sm:col-span-full lg:hidden">
          <p className="tabular-nums text-xs text-muted">{compact}</p>
          <RowActions inst={inst} className="flex sm:hidden" />
        </div>
      </div>
    </li>
  );
}

export function MarketDiscovery() {
  const { instruments, quotes, status, conn } = useMarket();
  const { stats, block, connected } = useOnchainFeed();
  const [sort, setSort] = useState<PoolSort>('volume');

  const rows = useMemo(
    () =>
      instruments
        .map((inst) => ({ inst, quote: quotes[inst.id], stat: stats[inst.id] }))
        .sort((a, b) => {
          const diff =
            sort === 'volume'
              ? (b.stat?.volumeUsd ?? -1) - (a.stat?.volumeUsd ?? -1)
              : sort === 'tvl'
                ? (b.stat?.tvlUsd ?? -1) - (a.stat?.tvlUsd ?? -1)
                : priceOf(b.quote) - priceOf(a.quote);
          return diff !== 0 ? diff : a.inst.symbol.localeCompare(b.inst.symbol);
        }),
    [instruments, quotes, stats, sort],
  );

  const totals = useMemo(() => {
    let tvlUsd = 0;
    let swaps = 0;
    let volumeUsd = 0;
    for (const s of Object.values(stats)) {
      if (s.tvlUsd != null) tvlUsd += s.tvlUsd;
      swaps += s.swaps;
      volumeUsd += s.volumeUsd;
    }
    return { tvlUsd, swaps, volumeUsd };
  }, [stats]);

  // Once every tracked pool's 1h backfill has landed the whole table is a 1h window.
  const statList = Object.values(stats);
  const backfilled = statList.length > 0 && statList.every((s) => s.backfilled);
  const loading = !status && conn === 'connecting';
  const empty = !loading && instruments.length === 0;

  return (
    <section id="markets" aria-labelledby="markets-heading" className="scroll-mt-24">
      <h2 id="markets-heading" className="sr-only">
        All markets
      </h2>

      {/* One-line summary of real totals, plus the chain head as a liveness signal. */}
      <p className="flex flex-wrap items-baseline gap-x-7 gap-y-1.5 text-sm text-muted">
        <span className="tabular-nums">
          <span className="font-medium text-ink">{formatUsdCompact(totals.tvlUsd)}</span> pool
          value
        </span>
        <span className="tabular-nums">
          <span className="font-medium text-ink">{totals.swaps.toLocaleString('en-US')}</span>{' '}
          trades {backfilled ? 'in 1h' : 'since connect'}
        </span>
        <span className="tabular-nums">
          <span className="font-medium text-ink">{formatUsdCompact(totals.volumeUsd)}</span> traded{' '}
          {backfilled ? 'in 1h' : 'since connect'}
        </span>
        <span className="inline-flex items-center gap-2 tabular-nums">
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 rounded-full ${
              connected === true
                ? 'bg-positive animate-pulse'
                : connected === false
                  ? 'bg-negative'
                  : 'bg-line'
            }`}
          />
          {block != null ? `chain at block ${block.toLocaleString('en-US')}` : 'waiting for the chain'}
        </span>
      </p>

      {/* Quiet underline tabs, same pattern as the hero symbol tabs. */}
      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2" role="group" aria-label="Sort markets">
        <span className="text-sm text-muted">Sort by</span>
        {SORTS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            aria-pressed={sort === key}
            onClick={() => setSort(key)}
            className={`h-7 border-b-2 text-sm font-medium transition-colors ${
              sort === key ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <>
          <p className="mt-4 text-sm text-muted" role="status">
            Reading the pools…
          </p>
          <div className="mt-3">
            <SkeletonRows rows={6} />
          </div>
        </>
      ) : empty ? (
        <div className="mt-4">
          <StatePanel title="No markets available right now.">
            The instrument registry could not be loaded. Try again in a moment; nothing on this page
            is cached or faked.
          </StatePanel>
        </div>
      ) : (
        <div className="mt-4 rounded-panel border border-line bg-surface">
          <div
            className={`${GRID} hidden pb-2.5 pt-4 text-xs text-muted sm:grid`}
            aria-hidden="true"
          >
            <span>Market</span>
            <span className="text-right">Price</span>
            <span className="text-right">Change</span>
            <span className="hidden text-right lg:block">Pool value</span>
            <span className="hidden text-right lg:block">Trades</span>
            <span className="hidden text-right sm:block">Volume</span>
            <span />
          </div>
          <ul aria-label="Market pools">
            {rows.map(({ inst, quote, stat }) => (
              <PoolRow key={inst.id} inst={inst} quote={quote} stat={stat} />
            ))}
          </ul>
        </div>
      )}

      <p className="mt-3 text-xs leading-relaxed text-muted">
        Prices are real Uniswap pool prices on Robinhood Chain. Pool value is the live balance of
        both tokens in each pool. Trades, volume and change count from the moment this server
        connected, so they restart from zero. Nothing here is simulated.
      </p>
    </section>
  );
}
