import { config } from './config.js';
import { ONCHAIN_INSTRUMENTS, BY_ID } from './registry.js';
import {
  applyOnchainQuote,
  pushOnchainEvents,
  patchChainStatus,
  chainUsable,
  getChainLastEventAt,
} from './store.js';
import type { OnchainEvent, OnchainBalances, OnchainStats } from '../src/types/quote.js';

/**
 * Robinhood Chain (Arbitrum Orbit, chainId 4663) — onchain RWA data.
 * One server-side WS connection: pool prices from Uniswap V3 Swap events,
 * a live ERC-20 Transfer feed, wallet balances, and wallet transfer history.
 * Raw JSON-RPC over the global WebSocket — no SDK, no new dependency.
 */

const SWAP_TOPIC = '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67';
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const CHAIN_ID = 4663;
const USDG_DECIMALS = 6;
const WETH_DECIMALS = 18;

/**
 * Candidate Uniswap V3 pools per token (located via factory.getPool 2026-09-07).
 * At bootstrap each token picks its most-active pool by real swap count — price
 * comes from the market where the token actually trades, not just any pool.
 */
const CANDIDATES: Record<string, Array<{ pool: string; quote: 'usdg' | 'weth' }>> = {
  nvda: [
    { pool: '0xb75d2d02b0ec3de50d32e40a4f1a8dae8acc4333', quote: 'usdg' },
    { pool: '0x62ab521f71431f78ac374cdbadc6cda3c8916b6c', quote: 'weth' },
  ],
  aapl: [
    { pool: '0xaae0d815ee56e4092a5e5c2911e676fea50b2d6d', quote: 'usdg' },
    { pool: '0xe4d4ba605b042054bd8815d515d98ddf46232622', quote: 'weth' },
  ],
  tsla: [
    { pool: '0x7868622ff2c3b1b6c8acb15fe0bdaebf043dda48', quote: 'usdg' },
    { pool: '0xa953ca88ff430e9487c60ca34d757414f4efda07', quote: 'weth' },
  ],
  amzn: [
    { pool: '0x7b242dfa849419242e3733308d5c91fe2a7dae7e', quote: 'usdg' },
    { pool: '0x8b2a73a8234cfc12b8b53ae048d0ddf76bfac37c', quote: 'weth' },
    // 1% tier — the only AMZN pool with a sane price; the others are dust/manipulated.
    { pool: '0x2232a2d6382bffdf18d4cd434b45d11a6b1c24ce', quote: 'weth' },
  ],
  googl: [
    { pool: '0xa3617bb4d7dc9dd20f79165486097a54b3593164', quote: 'usdg' },
    { pool: '0x8fb9301586f27e2cff85312f7c1d0f16c6167cde', quote: 'weth' },
  ],
  djt: [
    { pool: '0x336672031dca39d4160f61106db0e92295ddad6f', quote: 'usdg' },
    { pool: '0x95def4ea143630d64caa8f55f7570d8023f20265', quote: 'weth' },
  ],
  gme: [
    { pool: '0xb7723619e09e9317b3e538e7531ecbb910aec107', quote: 'usdg' },
    { pool: '0xc6bcc95043dc48c204bb2d57fb264a10efe0a607', quote: 'weth' },
  ],
  amc: [
    { pool: '0x5c329ec542f9f88b6fb7530e55c06f7b0b5e242f', quote: 'usdg' },
    { pool: '0xcf38764ae8c92222af4358a701871a6235cfc7b7', quote: 'weth' },
  ],
  spcx: [
    { pool: '0x87c58b43537005189cfc7b512d818dc9125e94fc', quote: 'usdg' },
    { pool: '0x7b35d2d016d11e56b82fcb4ba3790dc1c9f8e2f3', quote: 'weth' },
  ],
  weth: [{ pool: '0x52e65b17fb6e5ba00ed806f37afcd2daa50271ca', quote: 'usdg' }],
  // usdg is the quote side everywhere — priced at its $1 issuer peg, never derived.
};

/** Base-token decimals (verified via eth_call): every listed token is 18. */
const BASE_DECIMALS: Record<string, number> = Object.fromEntries(
  ONCHAIN_INSTRUMENTS.map((i) => [i.id, i.id === 'usdg' ? USDG_DECIMALS : WETH_DECIMALS]),
);

/** Chosen pool per instrument + its orientation (base token is token0?), set at bootstrap. */
const chosenPool = new Map<string, { pool: string; quote: 'usdg' | 'weth' }>();
const poolBaseIsToken0 = new Map<string, boolean>();
const poolCfgByAddress = new Map<string, { pool: string; quote: 'usdg' | 'weth' }>();

const TOKEN_BY_ADDRESS = new Map(ONCHAIN_INSTRUMENTS.map((i) => [i.tokenAddress!.toLowerCase(), i]));
const TOKEN_ADDRESSES = ONCHAIN_INSTRUMENTS.map((i) => i.tokenAddress!);

// ---- Live price + stats state ---------------------------------------------------

/** Latest USD price per instrument id (pool-derived; usdg = 1 by issuer peg). */
const prices = new Map<string, number>([['usdg', 1]]);
/** First observed price per instrument — the honest "since connection" change anchor. */
const anchors = new Map<string, number>();
/** Real swap activity per instrument since server connection. */
const stats: OnchainStats = {};

/** Block number → block timestamp (from newHeads headers) for event event-times. */
const blockTimes = new Map<number, number>();
const MAX_BLOCK_TIMES = 2000;

function blockTimeAt(blockNumber: number): string {
  const ts = blockTimes.get(blockNumber);
  // Missing header (range scan before connect): receipt time is still honest —
  // it's stamped as receipt, and the block number is shown alongside.
  return ts ? new Date(ts * 1000).toISOString() : new Date().toISOString();
}

// ---- JSON-RPC over WS -------------------------------------------------------------

let ws: WebSocket | null = null;
let reqId = 0;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
const subHandlers = new Map<string, (payload: unknown) => void>(); // subscription id → handler
let backoffMs = 1_000;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function rpc<T>(method: string, params: unknown[]): Promise<T> {
  if (!ws || ws.readyState !== WebSocket.OPEN) return Promise.reject(new Error('chain ws not open'));
  const id = ++reqId;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    ws!.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
  });
}

function connect() {
  if (!config.chainEnabled) return;
  try {
    ws = new WebSocket(config.chainWsUrl);
  } catch (err) {
    console.error('[chain] WS construct failed:', err instanceof Error ? err.message : err);
    scheduleReconnect();
    return;
  }
  const sock = ws;
  sock.onopen = () => {
    backoffMs = 1_000;
    patchChainStatus({ connected: true });
    bootstrap()
      .then(() => subscribeAll())
      .catch((err) => {
        console.error('[chain] bootstrap failed:', err instanceof Error ? err.message : err);
        sock.close();
      });
  };
  sock.onmessage = (ev: MessageEvent) => {
    const m = JSON.parse(String(ev.data)) as {
      id?: number;
      result?: unknown;
      error?: { message: string };
      method?: string;
      params?: { subscription: string; result: unknown };
    };
    if (m.id !== undefined && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id)!;
      pending.delete(m.id);
      if (m.error) reject(new Error(m.error.message));
      else resolve(m.result);
      return;
    }
    if (m.method === 'eth_subscription' && m.params) {
      patchChainStatus({ lastEventAt: new Date().toISOString() });
      const handler = subHandlers.get(m.params.subscription);
      if (handler) handler(m.params.result);
    }
  };
  sock.onclose = () => {
    if (ws !== sock) return; // stale socket from an earlier lifecycle
    ws = null;
    subHandlers.clear();
    patchChainStatus({ connected: false });
    scheduleReconnect();
  };
  sock.onerror = () => {
    /* close always follows; handled in onclose */
  };
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  const wait = Math.min(backoffMs, 30_000);
  backoffMs = Math.min(backoffMs * 2, 30_000);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, wait);
}

// ---- Price math -------------------------------------------------------------------

/** Uniswap V3: human-unit price of token1 in terms of token0 from sqrtPriceX96. */
function poolPrice(sqrtX96: bigint, dec0: number, dec1: number): number {
  // float64 is fine here — display prices, not accounting (≈15 significant digits).
  return (Number(sqrtX96 * sqrtX96) / Number(1n << 192n)) * 10 ** (dec0 - dec1);
}

/** int256 two's-complement (hex word) → signed BigInt. */
function signedInt(word: string): bigint {
  const v = BigInt(word);
  return v >= 1n << 255n ? v - (1n << 256n) : v;
}

/** USD price implied by a pool's sqrtPriceX96, cross-rated through WETH when needed. */
function usdFromPool(
  instrumentId: string,
  sqrtX96: bigint,
  baseIsToken0: boolean,
  quote: 'usdg' | 'weth',
): number | null {
  const dec = BASE_DECIMALS[instrumentId] ?? 18;
  if (quote === 'usdg') {
    // poolPrice = USDG per base when base is token0; base per USDG otherwise.
    const p = baseIsToken0
      ? poolPrice(sqrtX96, dec, USDG_DECIMALS)
      : 1 / poolPrice(sqrtX96, USDG_DECIMALS, dec);
    return p;
  }
  const wethUsd = prices.get('weth');
  if (!wethUsd) return null; // WETH/USDG seed runs first in bootstrap
  const p = baseIsToken0
    ? poolPrice(sqrtX96, dec, WETH_DECIMALS) // WETH per base
    : 1 / poolPrice(sqrtX96, WETH_DECIMALS, dec); // base per WETH → WETH per base
  return p * wethUsd;
}

function applyPoolPrice(instrumentId: string, sqrtX96: bigint, at: string) {
  const cfg = chosenPool.get(instrumentId);
  if (!cfg) return;
  const usd = usdFromPool(instrumentId, sqrtX96, poolBaseIsToken0.get(cfg.pool) ?? true, cfg.quote);
  if (usd === null || !Number.isFinite(usd) || usd <= 0 || usd > 1e9) return; // parse/orientation guard
  prices.set(instrumentId, usd);
  if (!anchors.has(instrumentId)) anchors.set(instrumentId, usd);
  const anchor = anchors.get(instrumentId)!;
  applyOnchainQuote(instrumentId, usd, String(anchor), ((usd - anchor) / anchor) * 100, at);
}

// ---- Event handlers ----------------------------------------------------------------

function onSwapLogRouted(log: { address: string; data: string; blockNumber: string }) {
  const cfg = poolCfgByAddress.get(log.address.toLowerCase());
  if (!cfg) return;
  const baseId = [...chosenPool.entries()].find(([, c]) => c.pool === log.address.toLowerCase())?.[0];
  if (!baseId) return;
  const words = log.data.slice(2).match(/.{64}/g);
  if (!words || words.length < 5) return;
  applyPoolPrice(baseId, BigInt('0x' + words[2]), blockTimeAt(parseInt(log.blockNumber, 16)));
  // Volume in USD: the quote-token side of the swap. Credit both legs (both moved).
  const baseIsToken0 = poolBaseIsToken0.get(cfg.pool) ?? true;
  const quoteWord = baseIsToken0 ? words[1] : words[0]; // token1 side when base is token0
  const quoteDec = cfg.quote === 'usdg' ? USDG_DECIMALS : WETH_DECIMALS;
  let usd = Math.abs(Number(signedInt('0x' + quoteWord))) / 10 ** quoteDec;
  if (cfg.quote === 'weth') usd *= prices.get('weth') ?? 0;
  const credit = (id: string) => {
    const s = (stats[id] ??= { swaps: 0, volumeUsd: 0 });
    s.swaps++;
    s.volumeUsd += usd;
  };
  credit(baseId);
  credit(cfg.quote);
}

let transferBuffer: OnchainEvent[] = [];
let transferFlushTimer: ReturnType<typeof setTimeout> | null = null;

function onTransferLog(log: {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  transactionHash: string;
  logIndex: string;
}) {
  const inst = TOKEN_BY_ADDRESS.get(log.address.toLowerCase());
  const [from, to] = [log.topics[1], log.topics[2]];
  if (!inst || !from || !to) return;
  const amount = Number(BigInt(log.data === '0x' ? '0' : log.data)) / 10 ** BASE_DECIMALS[inst.id]!;
  const price = prices.get(inst.id) ?? null;
  transferBuffer.push({
    id: `${log.transactionHash}-${parseInt(log.logIndex, 16)}`,
    kind: 'transfer',
    symbol: inst.symbol,
    amount: amount.toLocaleString('en-US', { maximumFractionDigits: 4 }),
    usdValue: price !== null ? amount * price : null,
    from: '0x' + from.slice(-40),
    to: '0x' + to.slice(-40),
    txHash: log.transactionHash,
    blockNumber: parseInt(log.blockNumber, 16),
    at: blockTimeAt(parseInt(log.blockNumber, 16)),
  });
  if (!transferFlushTimer) {
    // Burst-safe: batch transfers to SSE at most ~2×/s.
    transferFlushTimer = setTimeout(() => {
      transferFlushTimer = null;
      if (transferBuffer.length === 0) return;
      pushOnchainEvents(transferBuffer);
      transferBuffer = [];
    }, 500);
  }
}

// ---- Bootstrap + subscriptions -------------------------------------------------------

async function token0Of(pool: string): Promise<string> {
  const r = (await rpc<string>('eth_call', [{ to: pool, data: '0x0dfe1681' }, 'latest'])) as string;
  return '0x' + r.slice(-40).toLowerCase();
}

async function seedFromSlot0(instrumentId: string, pool: string) {
  const slot0 = (await rpc<string>('eth_call', [{ to: pool, data: '0x3850c7bd' }, 'latest'])) as string;
  applyPoolPrice(instrumentId, BigInt('0x' + slot0.slice(2, 66)), new Date().toISOString());
}

/** Real swap count of a pool over recent blocks — the pool-selection signal. */
async function latestBlock(): Promise<number> {
  // Nitro's eth_blockNumber takes no params (Geth ignores them) — send none.
  const hex = (await rpc<string>('eth_blockNumber', [])) as string;
  return parseInt(hex, 16);
}

async function swapCount(pool: string, latest: number): Promise<number> {
  const from = Math.max(0, latest - 4_000); // ~17 min of blocks
  const logs = await rpc<unknown[]>('eth_getLogs', [
    { fromBlock: '0x' + from.toString(16), toBlock: 'latest', address: pool, topics: [SWAP_TOPIC] },
  ]);
  return logs.length;
}

/**
 * Plausibility band for a pool's implied USD price. Every listed instrument is
 * a USD-denominated asset; a pool implying $1M+ or sub-cent prices is drained
 * or manipulated — excluded from selection even when it is the busiest.
 */
const SANE_USD: [number, number] = [0.01, 100_000];

/** Implied USD price from a pool's current state; caches the pool's orientation. */
async function impliedUsd(instrumentId: string, pool: string, quote: 'usdg' | 'weth'): Promise<number | null> {
  const baseIsToken0 = (await token0Of(pool)) === BY_ID.get(instrumentId)!.tokenAddress!.toLowerCase();
  poolBaseIsToken0.set(pool, baseIsToken0);
  const slot0 = (await rpc<string>('eth_call', [{ to: pool, data: '0x3850c7bd' }, 'latest'])) as string;
  return usdFromPool(instrumentId, BigInt('0x' + slot0.slice(2, 66)), baseIsToken0, quote);
}

/** Seed prices and pick each token's pool — also the reconnect path. */
async function bootstrap() {
  const latest = await latestBlock();

  // WETH/USDG seeds first — the cross-rate every weth-quoted pool depends on.
  const wethCand = CANDIDATES.weth![0]!;
  poolBaseIsToken0.set(wethCand.pool, (await token0Of(wethCand.pool)) === BY_ID.get('weth')!.tokenAddress!.toLowerCase());
  chosenPool.set('weth', wethCand);
  poolCfgByAddress.set(wethCand.pool, wethCand);
  await seedFromSlot0('weth', wethCand.pool);

  for (const [id, cands] of Object.entries(CANDIDATES)) {
    if (id === 'weth') continue;
    // Evaluate every candidate: implied price + real activity. Prefer pools with
    // a sane price; among those, the busiest one. Sanity beats busyness — a
    // manipulated pool can be the most active and still price an asset at $1M.
    const evals = await Promise.all(
      cands.map(async (c) => ({
        cfg: c,
        usd: await impliedUsd(id, c.pool, c.quote),
        swaps: 0,
      })),
    );
    const counts = await Promise.all(evals.map((e) => swapCount(e.cfg.pool, latest)));
    evals.forEach((e, i) => (e.swaps = counts[i]!));
    const sane = evals.filter((e) => e.usd !== null && e.usd >= SANE_USD[0] && e.usd <= SANE_USD[1]);
    const pool_ = (sane.length > 0 ? sane : evals).sort((a, b) => b.swaps - a.swaps)[0]!.cfg;
    chosenPool.set(id, pool_);
    poolCfgByAddress.set(pool_.pool, pool_);
    await seedFromSlot0(id, pool_.pool);
  }

  // USDG: $1 issuer redemption rate — a defined peg, labeled as such in the registry.
  applyOnchainQuote('usdg', 1, '1', 0, new Date().toISOString(), 'usdg-peg');
  console.log(
    `[chain] Robinhood Chain (${CHAIN_ID}) ready — pools:`,
    Object.keys(CANDIDATES)
      .map((id) => {
        const c = chosenPool.get(id)!;
        return `${id}(${c.quote})=${prices.get(id)?.toFixed(2)}`;
      })
      .join(' '),
  );
}

async function subscribeAll() {
  const pools = [...poolCfgByAddress.keys()];
  const swapSub = (await rpc<string>('eth_subscribe', [
    'logs',
    { address: pools, topics: [SWAP_TOPIC] },
  ])) as string;
  subHandlers.set(swapSub, (payload) => onSwapLogRouted(payload as { address: string; data: string; blockNumber: string }));

  const transferSub = (await rpc<string>('eth_subscribe', [
    'logs',
    { address: TOKEN_ADDRESSES, topics: [TRANSFER_TOPIC] },
  ])) as string;
  subHandlers.set(transferSub, (payload) => onTransferLog(payload as never));

  const headSub = (await rpc<string>('eth_subscribe', ['newHeads'])) as string;
  subHandlers.set(headSub, (head) => {
    const { number, timestamp } = head as { number: string; timestamp: string };
    const n = parseInt(number, 16);
    blockTimes.set(n, parseInt(timestamp, 16));
    if (blockTimes.size > MAX_BLOCK_TIMES) {
      // Evict oldest entries (Map preserves insertion order).
      for (const k of blockTimes.keys()) {
        blockTimes.delete(k);
        if (blockTimes.size <= MAX_BLOCK_TIMES) break;
      }
    }
    patchChainStatus({ blockNumber: n });
  });
}

// ---- Read APIs (balances, wallet history) ---------------------------------------------

export async function getBalances(address: string): Promise<OnchainBalances> {
  if (!chainUsable()) throw new Error('chain-not-connected');
  const [ethHex, ...tokenHexes] = await Promise.all([
    rpc<string>('eth_getBalance', [address, 'latest']),
    ...ONCHAIN_INSTRUMENTS.map((i) =>
      rpc<string>('eth_call', [{ to: i.tokenAddress, data: '0x70a08231' + address.slice(2).padStart(64, '0') }, 'latest']),
    ),
  ]);
  const eth = Number(BigInt(ethHex)) / 1e18;
  const balances = ONCHAIN_INSTRUMENTS.map((i, idx) => {
    const amount = Number(BigInt(tokenHexes[idx]!)) / 10 ** BASE_DECIMALS[i.id]!;
    const priceUsd = prices.get(i.id) ?? null;
    return {
      instrumentId: i.id,
      symbol: i.symbol,
      amount,
      priceUsd,
      valueUsd: priceUsd !== null ? amount * priceUsd : null,
    };
  });
  const wethPrice = prices.get('weth') ?? null;
  const ethValueUsd = wethPrice !== null ? eth * wethPrice : null;
  const parts = [ethValueUsd, ...balances.map((b) => b.valueUsd)].filter((v): v is number => v !== null);
  return {
    address,
    chainId: CHAIN_ID,
    eth,
    ethValueUsd,
    balances,
    totalValueUsd: parts.length ? parts.reduce((s, v) => s + v, 0) : null,
    fetchedAt: new Date().toISOString(),
  };
}

const TRANSFER_WINDOW_BLOCKS = 57_600; // ~4h at ~250ms/block — the labeled history window
const CHUNK = 4_000;

/** Real ERC-20 transfers of tracked tokens where the wallet is sender or receiver. */
export async function getWalletTransfers(address: string): Promise<OnchainEvent[]> {
  if (!chainUsable()) throw new Error('chain-not-connected');
  const latest = await latestBlock();
  const from = Math.max(0, latest - TRANSFER_WINDOW_BLOCKS);
  const padded = address.slice(2).padStart(64, '0');
  const out: OnchainEvent[] = [];
  type HistLog = {
    address: string; topics: string[]; data: string;
    blockNumber: string; transactionHash: string; logIndex: string;
  };
  for (const dir of [1, 2]) {
    // direction 1 = wallet is sender (topic1), 2 = receiver (topic2)
    const topics = dir === 1 ? [TRANSFER_TOPIC, '0x' + padded, null] : [TRANSFER_TOPIC, null, '0x' + padded];
    for (let end = latest; end > from; end -= CHUNK) {
      const logs = await rpc<HistLog[]>('eth_getLogs', [
        { fromBlock: '0x' + Math.max(from, end - CHUNK).toString(16), toBlock: '0x' + end.toString(16), address: TOKEN_ADDRESSES, topics },
      ]);
      for (const log of logs) {
        const inst = TOKEN_BY_ADDRESS.get(log.address.toLowerCase());
        if (!inst) continue;
        const amount = Number(BigInt(log.data === '0x' ? '0' : log.data)) / 10 ** BASE_DECIMALS[inst.id]!;
        const price = prices.get(inst.id) ?? null;
        out.push({
          id: `${log.transactionHash}-${parseInt(log.logIndex, 16)}`,
          kind: 'transfer',
          symbol: inst.symbol,
          amount: amount.toLocaleString('en-US', { maximumFractionDigits: 4 }),
          usdValue: price !== null ? amount * price : null,
          from: '0x' + (log.topics[1] ?? '').slice(-40),
          to: '0x' + (log.topics[2] ?? '').slice(-40),
          txHash: log.transactionHash,
          blockNumber: parseInt(log.blockNumber, 16),
          at: blockTimeAt(parseInt(log.blockNumber, 16)),
        });
      }
    }
  }
  return out.sort((a, b) => b.blockNumber - a.blockNumber).slice(0, 100);
}

export function getStats(): OnchainStats {
  return stats;
}

// ---- Entry -----------------------------------------------------------------------------

export function startChainData() {
  if (!config.chainEnabled) {
    console.log('[chain] KOVRA_CHAIN_ENABLED=false — onchain data disabled');
    return;
  }
  console.log(`[chain] connecting Robinhood Chain ws=${config.chainWsUrl}`);
  connect();
  // Dead-socket watchdog: chain events arrive multiple times per second, so a
  // full minute of silence while "connected" means a half-open socket — recycle it.
  setInterval(
    () => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const s = getChainStatusAgeMs();
      if (s !== null && s > 60_000) {
        console.warn('[chain] no frames for 60s — recycling dead socket');
        try {
          ws.close();
        } catch {
          /* close handler runs the reconnect */
        }
      }
    },
    20_000,
  ).unref?.();
}

/** ms since the last chain frame, from store status — null when never connected. */
function getChainStatusAgeMs(): number | null {
  const at = getChainLastEventAt();
  return at ? Date.now() - Date.parse(at) : null;
}
