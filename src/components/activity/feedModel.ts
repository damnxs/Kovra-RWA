import type { ChainLogEntry } from '../../types/quote';

/**
 * Pure model for the Activity page: turns the live chain log ring into the
 * rows the feed renders. Block events never get a row each; runs of blocks
 * collapse into one thin divider every BLOCK_DIVIDER_EVERY blocks so the
 * list stays calm while the chain keeps producing headers.
 */

export type FeedFilter = 'all' | 'swaps' | 'liquidity';

export type FeedItem =
  | { type: 'entry'; entry: ChainLogEntry }
  | { type: 'blocks'; block: number; span: number };

/** Render cap: enough depth to scroll, few enough rows to stay cheap. */
export const MAX_FEED_ROWS = 80;

/** At most one block divider per this many blocks. */
const BLOCK_DIVIDER_EVERY = 12;

/**
 * Newest-first log ring into feed items: kind and token filtered, block runs
 * collapsed into dividers (All view only), capped at MAX_FEED_ROWS.
 */
export function buildFeed(log: ChainLogEntry[], filter: FeedFilter, symbol: string): FeedItem[] {
  const dividers = filter === 'all' && symbol === 'all';
  const items: FeedItem[] = [];
  let anchor: number | null = null; // newest block seen so far on this walk
  for (const e of log) {
    if (e.kind === 'block') {
      const n = e.blockNumber;
      if (!dividers || n == null) continue;
      if (anchor === null) {
        anchor = n; // stay quiet until a stretch of blocks has actually passed
      } else if (anchor - n >= BLOCK_DIVIDER_EVERY) {
        items.push({ type: 'blocks', block: n, span: anchor - n });
        anchor = n;
      }
      continue;
    }
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
