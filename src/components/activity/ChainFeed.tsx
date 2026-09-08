import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { LuArrowRight, LuArrowUpRight } from 'react-icons/lu';
import { useMarket } from '../../data/MarketProvider';
import { useOnchainFeed } from '../../data/OnchainProvider';
import { formatPrice, formatTime, formatUsdCompact } from '../../lib/format';
import type { ChainLogEntry } from '../../types/quote';
import { buildFeed, type FeedFilter } from './feedModel';

/**
 * The unified live feed: one calm list of everything the market just did.
 * Swaps, liquidity updates and node state come from the shared chain log
 * ring; block headers collapse into thin dividers instead of rows, and
 * wallet-to-wallet transfers stay off the list entirely.
 * Every entry with a transaction hash links out to rh-scan.
 */

const TABS: Array<{ key: FeedFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'swaps', label: 'Trades' },
  { key: 'liquidity', label: 'Liquidity' },
];

const TX_URL = 'https://rh-scan.com/tx/';

export function ChainFeed({ className = '' }: { className?: string }) {
  const { log, connected } = useOnchainFeed();
  const { instruments } = useMarket();
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [symbol, setSymbol] = useState('all');

  const symbols = useMemo(() => instruments.map((i) => i.symbol), [instruments]);
  const items = useMemo(() => buildFeed(log, filter, symbol), [log, filter, symbol]);

  // Ids of entries that arrived after the feed first filled: these flash.
  // Ids are remembered, so switching tabs or tokens never re-flashes old rows.
  const seenRef = useRef<Set<string> | null>(null);
  const freshIds = useMemo(() => {
    const seen = (seenRef.current ??= new Set());
    const firstFill = seen.size === 0;
    const fresh = new Set<string>();
    for (const item of items) {
      if (item.type !== 'entry') continue;
      if (!seen.has(item.entry.id)) {
        seen.add(item.entry.id);
        if (!firstFill) fresh.add(item.entry.id);
      }
    }
    return fresh;
  }, [items]);

  return (
    <section aria-label="Live chain feed" className={`rounded-panel border border-line bg-surface ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line px-4 pt-1 sm:px-5">
        <div className="tab-scroll -mb-px flex" role="group" aria-label="Activity filters">
          {TABS.map(({ key, label }) => {
            const active = key === filter;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(key)}
                className={`-mb-px flex h-11 shrink-0 items-center border-b-2 px-3 text-sm transition-colors first:pl-0 ${
                  active
                    ? 'border-accent font-medium text-ink'
                    : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <select
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          aria-label="Filter by token"
          className="h-9 shrink-0 rounded-control border border-line bg-surface px-2.5 text-sm text-muted transition-colors focus:border-ink"
        >
          <option value="all">All tokens</option>
          {symbols.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {connected === false && (
        <p
          role="status"
          className="border-b border-line bg-page px-4 py-2.5 text-xs leading-relaxed text-muted sm:px-5"
        >
          Reconnecting to Robinhood Chain. The feed resumes right here when the node is back,
          nothing is lost.
        </p>
      )}

      {items.length === 0 ? (
        <FeedEmpty connected={connected} filter={filter} symbol={symbol} />
      ) : (
        <>
          <div
            aria-hidden="true"
            className="hidden grid-cols-[64px_minmax(0,1fr)_140px_64px] gap-x-3 border-b border-line px-5 py-2 sm:grid"
          >
            <p className="eyebrow">Time</p>
            <p className="eyebrow">Event</p>
            <p className="eyebrow text-right">Value</p>
            <p className="eyebrow text-right">Tx</p>
          </div>
          <ol className="max-h-[65vh] overflow-y-auto" aria-label="Live chain activity, newest first">
            {items.map((item) =>
              item.type === 'entry' ? (
                <EntryRow key={item.entry.id} e={item.entry} fresh={freshIds.has(item.entry.id)} />
              ) : (
                <BlockDivider key={`blk-${item.block}`} block={item.block} span={item.span} />
              ),
            )}
          </ol>
        </>
      )}
    </section>
  );
}

/** A swap phrased from the taker's side: Bought/Sold + the token flow arrow. */
function swapLine(e: ChainLogEntry): { primary: ReactNode; secondary: ReactNode } {
  if (!e.side || !e.quoteSymbol) {
    return {
      primary: (
        <>
          Traded <span className="font-medium">{e.symbol}</span>
        </>
      ),
      secondary:
        e.price != null ? <>pool price {formatPrice(String(e.price))}</> : <>pool price pending</>,
    };
  }
  const buy = e.side === 'buy';
  return {
    primary: (
      <>
        <span className={buy ? 'text-positive' : 'text-negative'}>{buy ? 'Bought' : 'Sold'}</span>{' '}
        <span className="font-medium">{e.symbol}</span>
      </>
    ),
    // Buy pays the quote token, sell receives it: the arrow shows the flow.
    secondary: (
      <>
        <span className="inline-flex items-center gap-1 tabular-nums">
          {buy ? (
            <>
              {e.quoteSymbol} <LuArrowRight aria-hidden="true" className="h-3 w-3" /> {e.symbol}
            </>
          ) : (
            <>
              {e.symbol} <LuArrowRight aria-hidden="true" className="h-3 w-3" /> {e.quoteSymbol}
            </>
          )}
        </span>
        {e.price != null && <> · pool price {formatPrice(String(e.price))}</>}
      </>
    ),
  };
}

/** One real chain event, phrased for a person: bought, sold, refreshed. */
function EntryRow({ e, fresh = false }: { e: ChainLogEntry; fresh?: boolean }) {
  // Fresh rows flash once on mount; local state keeps the wash alive even
  // after the fresh id set moves on with the next event batch.
  const [flashing, setFlashing] = useState(fresh);
  useEffect(() => {
    if (!fresh) return;
    const t = setTimeout(() => setFlashing(false), 1300);
    return () => clearTimeout(t);
  }, [fresh]);

  let primary: ReactNode;
  let secondary: ReactNode = null;
  let value: ReactNode = null;

  if (e.kind === 'swap') {
    ({ primary, secondary } = swapLine(e));
    value = usdCell(e.usdValue);
  } else if (e.kind === 'tvl') {
    primary = <>Pool value updated</>;
    secondary = (
      <>
        <span className="font-medium">{e.symbol}</span> pool, both sides valued at live prices
      </>
    );
    value = usdCell(e.usdValue);
  } else {
    primary = connText(e.detail);
  }

  const tx = e.txHash ? (
    <a
      href={`${TX_URL}${e.txHash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-0.5 whitespace-nowrap text-xs text-muted transition-colors hover:text-ink"
    >
      Tx <LuArrowUpRight aria-hidden="true" className="h-3 w-3" />
    </a>
  ) : null;

  return (
    <li
      className={`fade-in grid grid-cols-[56px_minmax(0,1fr)_auto] items-start gap-x-3 border-b border-line px-4 py-3 last:border-b-0 sm:grid-cols-[64px_minmax(0,1fr)_140px_64px] sm:px-5 ${
        flashing ? 'flash-new' : ''
      }`}
    >
      <p className="tabular-nums text-xs text-muted">{formatTime(e.at)}</p>
      <div className="min-w-0">
        <p className="truncate text-sm">{primary}</p>
        {secondary && <p className="mt-0.5 truncate text-xs text-muted">{secondary}</p>}
      </div>
      <div className="text-right">
        <p className="tabular-nums text-sm">{value}</p>
        {tx && <div className="mt-0.5 sm:hidden">{tx}</div>}
      </div>
      <div className="hidden justify-self-end sm:block">{tx}</div>
    </li>
  );
}

/** A run of block headers, collapsed into one quiet ticker line. */
function BlockDivider({ block, span }: { block: number; span: number }) {
  return (
    <li aria-hidden="true" className="fade-in flex items-center gap-3 px-4 py-2 sm:px-5">
      <span className="h-px flex-1 bg-line" />
      <span className="whitespace-nowrap text-xs tabular-nums text-muted">
        Block {block.toLocaleString('en-US')}
        {span >= 2 ? ` · ${span.toLocaleString('en-US')} blocks` : ''}
      </span>
      <span className="h-px flex-1 bg-line" />
    </li>
  );
}

function usdCell(usd: number | null | undefined): ReactNode {
  return typeof usd === 'number' ? (
    formatUsdCompact(usd)
  ) : (
    <span className="text-muted">pending</span>
  );
}

/** Node state lines from the server, retold in plain words. */
function connText(detail: string | undefined): string {
  if (!detail) return 'Chain node event';
  if (detail.startsWith('connected')) return 'Connected to Robinhood Chain';
  if (detail.startsWith('disconnected')) return 'Connection dropped, reconnecting';
  return detail;
}

function FeedEmpty({
  connected,
  filter,
  symbol,
}: {
  connected: boolean | null;
  filter: FeedFilter;
  symbol: string;
}) {
  const tab = TABS.find((t) => t.key === filter)?.label.toLowerCase() ?? 'events';
  let title: string;
  let body: string;
  if (connected === false) {
    title = 'Reconnecting to Robinhood Chain…';
    body =
      'The server lost its chain connection and is retrying automatically. Real events resume here the moment it reconnects.';
  } else if (filter !== 'all' || symbol !== 'all') {
    title = 'Waiting for chain activity…';
    body = `No ${tab}${symbol !== 'all' ? ` for ${symbol}` : ''} in the live window right now. Only real events are ever shown, so quiet moments stay quiet.`;
  } else {
    title = 'Waiting for chain activity…';
    body =
      'Real trades and liquidity updates appear here the moment they confirm on Robinhood Chain.';
  }
  return (
    <div className="px-5 py-12">
      <p className="font-medium">{title}</p>
      <p className="mt-1 max-w-lg text-sm leading-relaxed text-muted">{body}</p>
    </div>
  );
}
