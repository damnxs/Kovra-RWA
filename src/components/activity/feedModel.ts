import type { ChainLogEntry } from '../../types/quote';

/**
 * Pure model for the Activity page: turns the live chain log ring into the
 * rows the feed renders. Blocks never get a row: only real events do.
 */

export type FeedFilter = 'all' | 'swaps' | 'liquidity';

export type FeedItem = { type: 'entry'; entry: ChainLogEntry };

/** Render cap: enough depth to scroll, few enough rows to stay cheap. */
export const MAX_FEED_ROWS = 80;

/**
 * Newest-first log ring into feed items: kind and token filtered, capped at
 * MAX_FEED_ROWS.
 */
export function buildFeed(log: ChainLogEntry[], filter: FeedFilter, symbol: string): FeedItem[] {
  const items: FeedItem[] = [];
  for (const e of log) {
    if (e.kind === 'block') continue;
    // Wallet-to-wallet transfers stay out of the feed: they are not trades and
    // they drown the market signal (WETH/USDG settle constantly).
    if (e.kind === 'transfer') continue;
    if (filter === 'swaps' && e.kind !== 'swap') continue;
    if (filter === 'liquidity' && e.kind !== 'tvl') continue;
    if (symbol !== 'all' && e.symbol !== symbol) continue;
    items.push({ type: 'entry', entry: e });
  }
  return items.slice(0, MAX_FEED_ROWS);
}

/** Window totals for the summary strip: only what this page actually holds. */
export function summarizeWindow(log: ChainLogEntry[]): {
  transferVolumeUsd: number;
  transfers: number;
  swaps: number;
} {
  let transferVolumeUsd = 0;
  let transfers = 0;
  let swaps = 0;
  for (const e of log) {
    if (e.kind === 'transfer') {
      transfers++;
      if (typeof e.usdValue === 'number') transferVolumeUsd += e.usdValue;
    } else if (e.kind === 'swap') {
      swaps++;
    }
  }
  return { transferVolumeUsd, transfers, swaps };
}
