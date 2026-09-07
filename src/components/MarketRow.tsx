import { Link } from 'react-router-dom';
import type { Instrument, Quote, HistoryPoint } from '../types/quote';
import { formatPrice, formatTime } from '../lib/format';
import { PriceCell } from './PriceCell';
import { ChangeLabel } from './ChangeLabel';
import { Sparkline } from './Sparkline';
import { Chip } from './Chip';

export function MarketRow({
  instrument,
  quote,
  points,
  watched,
  onToggleWatch,
  action = 'watch',
}: {
  instrument: Instrument;
  quote?: Quote;
  points?: HistoryPoint[];
  watched?: boolean;
  onToggleWatch?: (id: string, symbol?: string) => void;
  /** 'trade' renders a Trade link to /trade/:id instead of the watch toggle. */
  action?: 'watch' | 'trade';
}) {
  const { symbol, name, id } = instrument;
  return (
    <li className="border-b border-line last:border-b-0">
      {/* ponytail: 4 cols at sm, full 5-col grid only at lg — 5 cols below 1024 starve the identity column */}
      <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-4 py-4 transition-colors hover:bg-page sm:grid-cols-[minmax(0,1fr)_150px_120px_96px] sm:px-5 lg:grid-cols-[minmax(0,1fr)_120px_170px_120px_96px]">
        <div className="min-w-0">
          <Link to={`/markets/${id}`} className="group block">
            <p className="flex items-baseline gap-2">
              <span className="text-[15px] font-semibold group-hover:underline group-hover:decoration-line group-hover:underline-offset-4">
                {symbol}
              </span>
              <span className="truncate text-sm text-muted">{name}</span>
            </p>
            <p className="mt-0.5 truncate text-xs text-muted">
              {instrument.type === 'token'
                ? `Onchain token · ${instrument.proxyLabel} · ${instrument.venue}`
                : `ETF · ${instrument.proxyLabel} · ${instrument.venue}`}
            </p>
          </Link>
        </div>

        <div className="hidden lg:block">
          <Sparkline points={points} />
        </div>

        <div className="text-right">
          {quote ? (
            <p className="text-[15px] font-medium">
              <PriceCell price={formatPrice(quote.price)} />{' '}
              <span className="text-xs text-muted">{quote.currency}</span>
            </p>
          ) : (
            <p className="text-sm text-muted">—</p>
          )}
        </div>

        <div className="col-span-2 flex flex-wrap items-center justify-between gap-2 sm:col-span-1 sm:block sm:text-right">
          {quote ? (
            <>
              <ChangeLabel pct={quote.changePct} />
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted sm:justify-end">
                {quote.stale && <Chip tone="warn">Stale</Chip>}
                <span className="tabular-nums whitespace-nowrap">as of {formatTime(quote.sourceTimestamp)}</span>
              </p>
            </>
          ) : (
            <p className="text-sm text-muted">Awaiting data</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-1">
          {action === 'trade' ? (
            <Link
              to={`/trade/${id}`}
              aria-label={`Trade ${symbol}`}
              className="flex h-11 items-center rounded-control bg-accent px-4 text-sm font-medium text-ink transition-opacity hover:opacity-85"
            >
              Trade
            </Link>
          ) : (
            <button
              type="button"
              aria-pressed={watched}
              aria-label={watched ? `Remove ${symbol} from watchlist` : `Watch ${symbol}`}
              onClick={() => onToggleWatch?.(id, symbol)}
              className={`flex h-11 items-center rounded-control border px-3 text-sm font-medium transition-colors ${
                watched
                  ? 'border-transparent bg-accent-soft text-ink'
                  : 'border-line bg-surface text-muted hover:border-ink hover:text-ink'
              }`}
            >
              {watched ? 'Watching' : 'Watch'}
            </button>
          )}
          <Link
            to={`/markets/${id}`}
            aria-label={`View details for ${symbol}`}
            className="flex h-11 w-11 items-center justify-center rounded-control text-muted transition-colors hover:bg-accent-soft hover:text-ink"
          >
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </li>
  );
}
