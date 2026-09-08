/**
 * Live check for the onchain module: connects to Robinhood Chain, bootstraps
 * pool prices, and asserts each lands in a sane range plus a pool TVL per
 * pooled instrument. Run: npm run check:chain
 * Prints PASS/FAIL and exits non-zero on failure, no fixtures, real chain data.
 */
import { startChainData, getStats } from './chain.js';
import { getQuotes, getOnchainEvents } from './store.js';
import { ONCHAIN_INSTRUMENTS } from './registry.js';

const SANITY: Record<string, [number, number]> = {
  // USD ranges wide enough for market movement, tight enough to catch a broken
  // pool orientation (inverted price) or a decimals error (1e12 off).
  nvda: [10, 5_000],
  aapl: [10, 5_000],
  tsla: [10, 5_000],
  amzn: [10, 5_000],
  googl: [10, 5_000],
  djt: [1, 500],
  gme: [1, 500],
  amc: [1, 500],
  spcx: [10, 5_000],
  msft: [10, 5_000],
  meta: [10, 5_000],
  coin: [10, 5_000],
  spy: [10, 5_000],
  qqq: [10, 5_000],
  usdg: [0.99, 1.01],
};

/** Instruments with a chosen Uniswap pool, usdg is peg-priced, never pooled. */
const POOLED_IDS = ONCHAIN_INSTRUMENTS.map((i) => i.id).filter((id) => id !== 'usdg');

const timeout = setTimeout(() => {
  console.error('FAIL: timed out waiting for chain bootstrap');
  process.exit(1);
}, 30_000);

const started = Date.now();
const poll = setInterval(() => {
  const quotes = getQuotes();
  const ids = quotes.map((q) => q.instrumentId);
  const allPresent = ONCHAIN_INSTRUMENTS.every((i) => ids.includes(i.id));
  const tvlReady = POOLED_IDS.every((id) => getStats()[id]?.tvlUsd != null);
  if ((!allPresent || !tvlReady) && Date.now() - started < 29_000) return;
  clearTimeout(timeout);
  clearInterval(poll);

  let failed = false;
  for (const i of ONCHAIN_INSTRUMENTS) {
    const q = quotes.find((x) => x.instrumentId === i.id);
    const [lo, hi] = SANITY[i.id]!;
    if (!q) {
      console.error(`FAIL ${i.id.padEnd(6)} no quote`);
      failed = true;
      continue;
    }
    const p = Number(q.price);
    const ok = p >= lo && p <= hi;
    if (!ok) failed = true;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${i.id.padEnd(6)} $${p.toFixed(4).padStart(12)}  [${lo}..${hi}]  provider=${q.provider}`);
  }
  for (const id of POOLED_IDS) {
    const tvl = getStats()[id]?.tvlUsd;
    const ok = tvl != null && Number.isFinite(tvl) && tvl >= 0;
    if (!ok) failed = true;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${id.padEnd(6)} tvl $${tvl != null ? Math.round(tvl).toLocaleString('en-US') : 'n/a'}`);
  }
  console.log(`onchain feed events so far: ${getOnchainEvents().length}`);
  if (failed) process.exit(1);
  console.log('chain check: all prices sane, all pool TVLs present');
  process.exit(0);
}, 500);

startChainData();
