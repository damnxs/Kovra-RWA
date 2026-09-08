import { config } from './config.js';
import { ONCHAIN_INSTRUMENTS, BY_ID } from './registry.js';
import {
  applyOnchainQuote,
  pushOnchainEvents,
  pushOnchainStats,
  pushChainLog,
  patchChainStatus,
  chainUsable,
  getChainLastEventAt,
  seedHistory,
} from './store.js';
import type { OnchainEvent, OnchainBalances, OnchainStats, HistoryPoint } from '../src/types/quote.js';

/**
 * Robinhood Chain (Arbitrum Orbit, chainId 4663), onchain RWA data.
 * One server-side WS connection: pool prices from Uniswap V3 Swap events,
 * a live ERC-20 Transfer feed, wallet balances, and wallet transfer history.
 * Raw JSON-RPC over the global WebSocket, no SDK, no new dependency.
 */

const SWAP_TOPIC = '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67';
const MINT_TOPIC = '0x7a53080ba414158be7ec69b987b5fb7d07dee101fe85488f0853ae16239d0bde';
const BURN_TOPIC = '0x0c396cd989a39f4459b5fa1aed6a9a8dcdbc45908acfd67e028cd568da98982c';
const COLLECT_TOPIC = '0x70935338e69775456a85ddef226c395fb668b63fa0115f5f20610b388e6ca9c0';
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const CHAIN_ID = 4663;
const USDG_DECIMALS = 6;
const WETH_DECIMALS = 18;

/**
 * Candidate Uniswap V3 pools per token (located via factory.getPool 2026-09-07).
 * At bootstrap each token picks its most-active pool by real swap count, price
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
    // 1% tier, the only AMZN pool with a sane price; the others are dust/manipulated.
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
  // MSFT, META, COIN, SPY, QQQ: verified onchain + pools via factory.getPool, 2026-09-08.
  msft: [
    { pool: '0x3d69ea64810300877b938e9ad9916c25912c08f5', quote: 'usdg' },
    { pool: '0xeb60bcd1d920ad6e102690ccfc6fb488899e1510', quote: 'usdg' },
    { pool: '0x2ea9292113514ed84fd16aa4ad1e416537e39c8c', quote: 'usdg' },
    { pool: '0x98e196c9711280f8a4cdbd70f7e6bf4c3a649ce4', quote: 'weth' },
  ],
  meta: [
    { pool: '0xad6df50832884f3498cd354086cefb0e39070f1b', quote: 'usdg' },
    { pool: '0x107a7cb40d8665360ba10e59471af06150a50922', quote: 'usdg' },
    { pool: '0x6fd62e9843ad2ac2c4fbf2b62647953ea29b3537', quote: 'usdg' },
    { pool: '0xa4bdb396a69617eb7f70e2cc1ef526f7340b1b0d', quote: 'weth' },
  ],
  coin: [
    { pool: '0x1aa941420f6347cf004e2d21e40f0632d8862cf8', quote: 'usdg' },
    { pool: '0x5c51a0035051fa2db80aec8781be3bd6207d27e0', quote: 'usdg' },
    { pool: '0x6707aeac7d0e519b083219d27bb427364363183a', quote: 'weth' },
  ],
  spy: [
    { pool: '0xa7bb1ac63bbab0c44316e6c8c455213441689167', quote: 'usdg' },
    { pool: '0xa43b424bc609495aed4bcd88d654934b510b0ad9', quote: 'usdg' },
    { pool: '0xddcbba3666f578e3f09516f21ff85bfee859ab5e', quote: 'weth' },
  ],
  qqq: [
    { pool: '0x4539019b527211998642fec342c85dcb44c7e5e4', quote: 'usdg' },
    { pool: '0xd60a5d14db690b7afad71f76b108071d7175597d', quote: 'usdg' },
    { pool: '0xebd78dcfc8a6b3a696f1e191ad1ff321f9579f79', quote: 'usdg' },
    { pool: '0x8ec7ef7b775b04ab1000a122ce0ae1dcff509a5c', quote: 'weth' },
    { pool: '0xa40d00a55d43ba2d188039dcf88bd68f4f133e78', quote: 'weth' },
    { pool: '0x13444127f263a5ac1c545efcec022b467df91658', quote: 'weth' },
  ],
  // usdg is the quote side everywhere, priced at its $1 issuer peg, never derived.
};

/**
 * WETH is internal machinery, not a tracked market. Most stock pools quote
 * against it, so its USDG pool price is the live cross-rate behind their USD
 * values. It is priced and subscribed, but never shown, counted, or backfilled
 * as an instrument (project decision: Kovra tracks stock tokens only).
 */
const WETH_TOKEN = '0x0bd7d308f8e1639fab988df18a8011f41eacad73';
const WETH_POOL = '0x52e65b17fb6e5ba00ed806f37afcd2daa50271ca'; // WETH/USDG pool

/** Base-token decimals (verified via eth_call): every listed token is 18. */
const BASE_DECIMALS: Record<string, number> = Object.fromEntries(
  ONCHAIN_INSTRUMENTS.map((i) => [i.id, i.id === 'usdg' ? USDG_DECIMALS : WETH_DECIMALS]),
);

/** Chosen pool per instrument + its orientation (base token is token0?), set at bootstrap. */
const chosenPool = new Map<string, { pool: string; quote: 'usdg' | 'weth' }>();
/** Tracked markets (the stock tokens): everything user-facing touches only these. */
const trackedIds = new Set<string>();
const poolBaseIsToken0 = new Map<string, boolean>();
const poolCfgByAddress = new Map<string, { pool: string; quote: 'usdg' | 'weth' }>();
/** Chosen pool address → base instrument id, the log-routing reverse index. */
const baseByPool = new Map<string, string>();

const TOKEN_BY_ADDRESS = new Map(ONCHAIN_INSTRUMENTS.map((i) => [i.tokenAddress!.toLowerCase(), i]));
const TOKEN_ADDRESSES = ONCHAIN_INSTRUMENTS.map((i) => i.tokenAddress!);

// ---- Live price + stats state ---------------------------------------------------

/** Latest USD price per instrument id (pool-derived; usdg = 1 by issuer peg). */
const prices = new Map<string, number>([['usdg', 1]]);
/** First observed price per instrument, the honest "since connection" change anchor. */
const anchors = new Map<string, number>();
/** Real swap activity per instrument: rolling 24h window (backfill + live). */
const stats: OnchainStats = {};

// Volume lives as per-swap records, not bare counters, so a rolling 1h window
// can age old swaps out honestly instead of growing forever.
const VOLUME_WINDOW_BLOCKS = 14_400; // ~1h at ~250ms/block
const swapRecords = new Map<string, { b: number; usd: number; k: string }[]>();
const seenSwaps = new Set<string>(); // txHash-logIndex, window-bounded by pruning

/** Credit one swap to an instrument (and its quote token): dedupe, prune, recompute. */
function creditSwap(id: string, block: number, usd: number, k: string) {
  if (seenSwaps.has(k)) return;
  seenSwaps.add(k);
  const recs = swapRecords.get(id) ?? [];
  recs.push({ b: block, usd, k });
  const cutoff = block - VOLUME_WINDOW_BLOCKS;
  while (recs.length > 0 && recs[0]!.b < cutoff) seenSwaps.delete(recs.shift()!.k);
  swapRecords.set(id, recs);
  const s = (stats[id] ??= { swaps: 0, volumeUsd: 0 });
  s.swaps = recs.length;
  s.volumeUsd = recs.reduce((a, r) => a + r.usd, 0);
}

/** Block number → block timestamp (from newHeads headers) for event event-times. */
const blockTimes = new Map<number, number>();
const MAX_BLOCK_TIMES = 2000;

function blockTimeAt(blockNumber: number): string {
  const ts = blockTimes.get(blockNumber);
  // Missing header (range scan before connect): receipt time is still honest:
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

function rpc<T>(method: string, params: unknown[], timeoutMs = 15_000): Promise<T> {
  if (!ws || ws.readyState !== WebSocket.OPEN) return Promise.reject(new Error('chain ws not open'));
  const id = ++reqId;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`chain rpc timeout: ${method}`));
    }, timeoutMs);
    pending.set(id, {
      resolve: (v: unknown) => {
        clearTimeout(timer);
        resolve(v as T);
      },
      reject: (e: Error) => {
        clearTimeout(timer);
        reject(e);
      },
    });
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
      .then(() => {
        for (const id of trackedIds) safeSeedHistory(id); // backfill, off critical path
        safeBackfillVolume();
        pushChainLog({
          id: `conn-${Date.now()}`,
          kind: 'conn',
          at: new Date().toISOString(),
          detail: `connected · chainId ${CHAIN_ID}`,
        });
      })
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
    pushChainLog({
      id: `conn-${Date.now()}`,
      kind: 'conn',
      at: new Date().toISOString(),
      detail: 'disconnected · reconnecting',
    });
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
  // float64 is fine here, display prices, not accounting (≈15 significant digits).
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

/** One Swap log on a chosen pool: reprice the token and credit real volume. */
function onSwapLog(baseId: string, log: PoolLog) {
  const cfg = poolCfgByAddress.get(chosenPool.get(baseId)!.pool)!;
  const words = log.data.slice(2).match(/.{64}/g);
  if (!words || words.length < 5) return;
  const at = blockTimeAt(parseInt(log.blockNumber, 16));
  applyPoolPrice(baseId, BigInt('0x' + words[2]), at);
  if (baseId === 'weth') return; // internal cross-rate feed: repriced, never counted or shown
  // Volume in USD: the quote-token side of the swap.
  const baseIsToken0 = poolBaseIsToken0.get(cfg.pool) ?? true;
  const quoteWord = baseIsToken0 ? words[1] : words[0]; // token1 side when base is token0
  const baseWord = baseIsToken0 ? words[0] : words[1];
  const quoteDec = cfg.quote === 'usdg' ? USDG_DECIMALS : WETH_DECIMALS;
  let usd = Math.abs(Number(signedInt('0x' + quoteWord))) / 10 ** quoteDec;
  if (cfg.quote === 'weth') usd *= prices.get('weth') ?? 0;
  // Taker side: a negative base amount means the pool sent base out, someone bought.
  const side: 'buy' | 'sell' = signedInt('0x' + baseWord) < 0n ? 'buy' : 'sell';
  const k = `${log.transactionHash}-${parseInt(log.logIndex, 16)}`;
  creditSwap(baseId, parseInt(log.blockNumber, 16), usd, k);
  pushOnchainStats(stats);
  pushChainLog({
    id: `${log.transactionHash}-${parseInt(log.logIndex, 16)}`,
    kind: 'swap',
    at,
    blockNumber: parseInt(log.blockNumber, 16),
    txHash: log.transactionHash,
    symbol: BY_ID.get(baseId)!.symbol,
    price: prices.get(baseId),
    side,
    quoteSymbol: QUOTE_META[cfg.quote].symbol,
    usdValue: usd,
  });
}

type PoolLog = {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  transactionHash: string;
  logIndex: string;
};

/** Route one pool log: Swap reprices; Mint/Burn/Collect move TVL. */
function onPoolLog(log: PoolLog) {
  const id = baseByPool.get(log.address.toLowerCase());
  if (!id) return;
  if (log.topics[0] === SWAP_TOPIC) onSwapLog(id, log);
  else safeRefreshTvl(id);
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
  const id = `${log.transactionHash}-${parseInt(log.logIndex, 16)}`;
  pushChainLog({
    id,
    kind: 'transfer',
    at: blockTimeAt(parseInt(log.blockNumber, 16)),
    blockNumber: parseInt(log.blockNumber, 16),
    txHash: log.transactionHash,
    symbol: inst.symbol,
    amount,
    usdValue: price !== null ? amount * price : null,
    from: '0x' + from.slice(-40),
    to: '0x' + to.slice(-40),
  });
  transferBuffer.push({
    id,
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

// ---- Pool TVL (event-driven, same WS) --------------------------------------------------

const QUOTE_TOKEN = {
  usdg: BY_ID.get('usdg')!.tokenAddress!,
  weth: WETH_TOKEN,
} as const;

/** Quote-token metadata for labels and routes, independent of the tracked registry. */
const QUOTE_META = {
  usdg: { symbol: 'USDG', token: QUOTE_TOKEN.usdg, decimals: USDG_DECIMALS },
  weth: { symbol: 'WETH', token: WETH_TOKEN, decimals: WETH_DECIMALS },
} as const;

/** balanceOf(address) over the existing WS, same encoding getBalances uses. */
async function erc20BalanceOf(token: string, holder: string): Promise<bigint> {
  const r = (await rpc<string>('eth_call', [
    { to: token, data: '0x70a08231' + holder.slice(2).padStart(64, '0') },
    'latest',
  ])) as string;
  return BigInt(r && r !== '0x' ? r : '0x0');
}

const tvlInFlight = new Set<string>();

/**
 * Recompute one instrument's pool TVL: both token balances held by the chosen
 * pool × live USD prices. Triggered by real liquidity events (Mint/Burn/Collect)
 * and once per bootstrap, never on a timer, so quiet pools cost zero requests.
 * ponytail: swap fee accrual shifts balances marginally; it rides along with the
 * next liquidity event instead of a per-swap recompute.
 */
async function refreshTvl(id: string) {
  const cfg = chosenPool.get(id);
  if (!cfg || !trackedIds.has(id) || tvlInFlight.has(id)) return;
  tvlInFlight.add(id);
  try {
    const [baseRaw, quoteRaw] = await Promise.all([
      erc20BalanceOf(BY_ID.get(id)!.tokenAddress!, cfg.pool),
      erc20BalanceOf(QUOTE_TOKEN[cfg.quote], cfg.pool),
    ]);
    const baseUsd = prices.get(id);
    const quoteUsd = prices.get(cfg.quote);
    if (baseUsd == null || quoteUsd == null) return; // price not seeded yet
    const quoteDec = cfg.quote === 'usdg' ? USDG_DECIMALS : WETH_DECIMALS;
    const s = (stats[id] ??= { swaps: 0, volumeUsd: 0 });
    s.tvlUsd =
      (Number(baseRaw) / 10 ** BASE_DECIMALS[id]!) * baseUsd +
      (Number(quoteRaw) / 10 ** quoteDec) * quoteUsd;
    pushOnchainStats(stats);
    pushChainLog({
      id: `tvl-${id}-${Date.now()}`,
      kind: 'tvl',
      at: new Date().toISOString(),
      symbol: BY_ID.get(id)!.symbol,
      usdValue: s.tvlUsd,
    });
  } finally {
    tvlInFlight.delete(id);
  }
}

function safeRefreshTvl(id: string) {
  refreshTvl(id).catch((err) =>
    console.error(`[chain] tvl refresh failed (${id}):`, err instanceof Error ? err.message : err),
  );
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

/**
 * Replay the last ~30 real swaps into the history ring so a fresh boot draws a
 * chart immediately. Price per swap is that swap's own sqrtPriceX96; logs are
 * walked back in proven 4k-block windows (wide single queries hang this node);
 * timestamps are block-linear between two fetched anchor blocks (accurate to
 * seconds at ~4 blocks/s, and only used for x-position).
 */
async function seedHistoryFromSwaps(id: string, take = 30, maxChunks = 10) {
  const cfg = chosenPool.get(id);
  if (!cfg) return;
  const latest = await latestBlock();
  const SPAN = 4_000;
  const logs: PoolLog[] = [];
  for (let i = 0; i < maxChunks && logs.length < take; i++) {
    const end = latest - i * SPAN;
    const from = Math.max(0, end - SPAN);
    const chunk = await rpc<PoolLog[]>('eth_getLogs', [
      {
        fromBlock: '0x' + from.toString(16),
        toBlock: '0x' + end.toString(16),
        address: cfg.pool,
        topics: [SWAP_TOPIC],
      },
    ]);
    logs.unshift(...chunk);
    if (from === 0) break;
  }
  if (logs.length < 2) return;
  const recent = logs.slice(-take);
  const blockNums = recent.map((l) => parseInt(l.blockNumber, 16));
  const firstB = blockNums[0]!;
  const lastB = blockNums[blockNums.length - 1]!;
  if (lastB === firstB) return;
  const blockTs = async (n: number) => {
    const b = (await rpc<{ timestamp: string } | null>('eth_getBlockByNumber', [
      '0x' + n.toString(16),
      false,
    ])) as { timestamp: string } | null;
    return b ? parseInt(b.timestamp, 16) : null;
  };
  const [t0, t1] = await Promise.all([blockTs(firstB), blockTs(lastB)]);
  if (t0 == null || t1 == null) return;
  const perBlock = (t1 - t0) / (lastB - firstB);
  const baseIsToken0 = poolBaseIsToken0.get(cfg.pool) ?? true;
  const pts: HistoryPoint[] = [];
  for (const log of recent) {
    const words = log.data.slice(2).match(/.{64}/g);
    if (!words) continue;
    const usd = usdFromPool(id, BigInt('0x' + words[2]), baseIsToken0, cfg.quote);
    if (usd === null || !Number.isFinite(usd) || usd <= 0 || usd > 1e9) continue;
    const n = parseInt(log.blockNumber, 16);
    pts.push({ t: (t0 + (n - firstB) * perBlock) * 1000, p: String(usd) });
  }
  seedHistory(id, pts);
}

function safeSeedHistory(id: string) {
  // Off the critical path: live subscriptions start first, backfill follows.
  seedHistoryFromSwaps(id).catch((err) =>
    console.error(`[chain] history seed failed (${id}):`, err instanceof Error ? err.message : err),
  );
}

// ---- 24h volume backfill ------------------------------------------------------------

/** Walk a pool's Swap logs oldest-chunk-first so records and series come out ascending. */
async function swapLogsAscending(pool: string, from: number, head: number): Promise<PoolLog[]> {
  const out: PoolLog[] = [];
  for (let start = from; start < head; start += CHUNK) {
    const params = [
      {
        fromBlock: '0x' + start.toString(16),
        toBlock: '0x' + Math.min(head, start + CHUNK - 1).toString(16),
        address: pool,
        topics: [SWAP_TOPIC],
      },
    ];
    // One retry: a single slow chunk must not kill a 24h walk.
    const logs = await rpc<PoolLog[]>('eth_getLogs', params).catch(() => rpc<PoolLog[]>('eth_getLogs', params));
    out.push(...logs);
  }
  return out;
}

/**
 * Sparse WETH/USD price anchors over the volume window, the cross-rate
 * weth-quoted stock pools' historical USD volume is priced through. The WETH
 * pool settles multiple times per block and this node serves no archive
 * state, so reading every swap is far too slow; three tiny sampled windows
 * (start/middle/end, a few prints each) plus the live price keep a 1h
 * cross-rate well inside volume noise. Prices only, nothing credited to stats.
 */
async function wethPriceSeries(): Promise<{ b: number; usd: number }[]> {
  const head = await latestBlock();
  const baseIsToken0 = poolBaseIsToken0.get(WETH_POOL) ?? true;
  const series: { b: number; usd: number }[] = [];
  for (let i = 0; i < 3; i++) {
    const at = Math.max(0, head - VOLUME_WINDOW_BLOCKS + Math.round((VOLUME_WINDOW_BLOCKS / 3) * i));
    const logs = await swapLogsAscending(WETH_POOL, at, at + 200).catch(() => []);
    for (const log of logs.slice(0, 5)) {
      const words = log.data.slice(2).match(/.{64}/g);
      if (!words || words.length < 5) continue;
      const p = usdFromPool('weth', BigInt('0x' + words[2]), baseIsToken0, 'usdg');
      if (p !== null && Number.isFinite(p) && p > 0 && p < 1e9) {
        series.push({ b: parseInt(log.blockNumber, 16), usd: p });
      }
    }
  }
  return series;
}

/** Nearest WETH/USD print at or before a block; nearest/live price outside the series. */
function wethUsdNear(series: { b: number; usd: number }[], block: number): number {
  for (let i = series.length - 1; i >= 0; i--) if (series[i]!.b <= block) return series[i]!.usd;
  return series[0]?.usd ?? prices.get('weth') ?? 0;
}

/**
 * Replay real Swap logs from before the server connected so stock volume and
 * trade counts are a rolling 1h window, not "since boot". Same proven shape
 * as the history seed: per-pool eth_getLogs walked in 4k chunks; the id dedupe
 * in creditSwap makes the seam with the live subscription (and re-runs after a
 * reconnect) exactly-once.
 */
async function backfillPoolVolume(id: string, wethSeries: { b: number; usd: number }[]) {
  const cfg = chosenPool.get(id);
  if (!cfg || !trackedIds.has(id)) return;
  const head = await latestBlock();
  const from = Math.max(0, head - VOLUME_WINDOW_BLOCKS);
  const baseIsToken0 = poolBaseIsToken0.get(cfg.pool) ?? true;
  const quoteDec = cfg.quote === 'usdg' ? USDG_DECIMALS : WETH_DECIMALS;
  for (const log of await swapLogsAscending(cfg.pool, from, head)) {
    const words = log.data.slice(2).match(/.{64}/g);
    if (!words || words.length < 5) continue;
    const quoteWord = baseIsToken0 ? words[1] : words[0];
    let usd = Math.abs(Number(signedInt('0x' + quoteWord))) / 10 ** quoteDec;
    if (cfg.quote === 'weth') usd *= wethUsdNear(wethSeries, parseInt(log.blockNumber, 16));
    creditSwap(id, parseInt(log.blockNumber, 16), usd, `${log.transactionHash}-${parseInt(log.logIndex, 16)}`);
  }
  stats[id]!.backfilled = true;
  pushOnchainStats(stats);
}

async function backfillVolume() {
  // The WETH cross-rate series must exist before weth-quoted pools price their history.
  const series = await wethPriceSeries();
  const ids = [...trackedIds];
  const done = await Promise.allSettled(ids.map((id) => backfillPoolVolume(id, series)));
  pushOnchainStats(stats);
  const ok = done.filter((r) => r.status === 'fulfilled').length;
  console.log(`[chain] 1h volume backfill: ${ok}/${ids.length} stock pools covered`);
}

function safeBackfillVolume() {
  backfillVolume().catch((err) =>
    console.error('[chain] volume backfill failed:', err instanceof Error ? err.message : err),
  );
}

/** Real swap count of a pool over recent blocks, the pool-selection signal. */
async function latestBlock(): Promise<number> {
  // Nitro's eth_blockNumber takes no params (Geth ignores them), send none.
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
 * or manipulated, excluded from selection even when it is the busiest.
 */
const SANE_USD: [number, number] = [0.01, 100_000];

/** Implied USD price from a pool's current state; caches the pool's orientation. */
async function impliedUsd(instrumentId: string, pool: string, quote: 'usdg' | 'weth'): Promise<number | null> {
  const baseIsToken0 = (await token0Of(pool)) === BY_ID.get(instrumentId)!.tokenAddress!.toLowerCase();
  poolBaseIsToken0.set(pool, baseIsToken0);
  const slot0 = (await rpc<string>('eth_call', [{ to: pool, data: '0x3850c7bd' }, 'latest'])) as string;
  return usdFromPool(instrumentId, BigInt('0x' + slot0.slice(2, 66)), baseIsToken0, quote);
}

/** Seed prices and pick each token's pool, also the reconnect path. */
async function bootstrap() {
  const latest = await latestBlock();

  // WETH/USDG seeds first, the cross-rate every weth-quoted pool depends on.
  const wethCfg = { pool: WETH_POOL, quote: 'usdg' as const };
  poolBaseIsToken0.set(WETH_POOL, (await token0Of(WETH_POOL)) === WETH_TOKEN);
  chosenPool.set('weth', wethCfg);
  poolCfgByAddress.set(WETH_POOL, wethCfg);
  baseByPool.set(WETH_POOL, 'weth');
  await seedFromSlot0('weth', WETH_POOL);

  for (const [id, cands] of Object.entries(CANDIDATES)) {
    // Evaluate every candidate: implied price + real activity. Prefer pools with
    // a sane price; among those, the busiest one. Sanity beats busyness, a
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
    trackedIds.add(id);
    poolCfgByAddress.set(pool_.pool, pool_);
    baseByPool.set(pool_.pool, id);
    await seedFromSlot0(id, pool_.pool);
  }

  // USDG: $1 issuer redemption rate, a defined peg, labeled as such in the registry.
  applyOnchainQuote('usdg', 1, '1', 0, new Date().toISOString(), 'usdg-peg');
  for (const id of chosenPool.keys()) safeRefreshTvl(id); // one-time seed; events take over
  console.log(
    `[chain] Robinhood Chain (${CHAIN_ID}) ready, pools:`,
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
  // One subscription, four event types: Swap reprices, Mint/Burn/Collect re-TVL.
  const poolSub = (await rpc<string>('eth_subscribe', [
    'logs',
    { address: pools, topics: [[SWAP_TOPIC, MINT_TOPIC, BURN_TOPIC, COLLECT_TOPIC]] },
  ])) as string;
  subHandlers.set(poolSub, (payload) => onPoolLog(payload as PoolLog));

  const transferSub = (await rpc<string>('eth_subscribe', [
    'logs',
    { address: TOKEN_ADDRESSES, topics: [TRANSFER_TOPIC] },
  ])) as string;
  subHandlers.set(transferSub, (payload) => onTransferLog(payload as never));

  const headSub = (await rpc<string>('eth_subscribe', ['newHeads'])) as string;
  subHandlers.set(headSub, (head) => {
    const { number, timestamp } = head as { number: string; timestamp: string };
    const n = parseInt(number, 16);
    const ts = parseInt(timestamp, 16);
    blockTimes.set(n, ts);
    if (blockTimes.size > MAX_BLOCK_TIMES) {
      // Evict oldest entries (Map preserves insertion order).
      for (const k of blockTimes.keys()) {
        blockTimes.delete(k);
        if (blockTimes.size <= MAX_BLOCK_TIMES) break;
      }
    }
    patchChainStatus({ blockNumber: n });
    pushChainLog({ id: `blk-${n}`, kind: 'block', at: new Date(ts * 1000).toISOString(), blockNumber: n });
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

const TRANSFER_WINDOW_BLOCKS = 57_600; // ~4h at ~250ms/block, the labeled history window
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

// ---- Trade routes (what the frontend needs to route a real swap) ---------------------

/** Uniswap V3 SwapRouter02 on Robinhood Chain, verified onchain 2026-09-08. */
export const SWAP_ROUTER = '0xcaf681a66d020601342297493863e78c959e5cb2';
/** Uniswap V3 QuoterV2 on Robinhood Chain (quoteExactInputSingle, view-only). */
export const QUOTER_V2 = '0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7';

export type TradeRoute = {
  instrumentId: string;
  symbol: string;
  /** The chosen pool; informational, the router finds it from tokenIn/tokenOut/fee. */
  pool: string;
  /** Pool fee tier, raw uint24 (100 = 0.01%). */
  fee: number;
  quoteId: string;
  quoteSymbol: string;
  quoteToken: string;
  quoteDecimals: number;
  baseToken: string;
  baseDecimals: number;
};

const poolFeeCache = new Map<string, Promise<number>>();

/** fee() view per pool, cached; a failed read un-caches so it can retry. */
function poolFee(pool: string): Promise<number> {
  let p = poolFeeCache.get(pool);
  if (!p) {
    p = rpc<string>('eth_call', [{ to: pool, data: '0xddca3f43' }, 'latest']).then((r) =>
      parseInt(r, 16),
    );
    poolFeeCache.set(pool, p);
    p.catch(() => poolFeeCache.delete(pool));
  }
  return p;
}

/** One route per tracked instrument: which token pays, which pool tier executes. */
export async function getTradeRoutes(): Promise<TradeRoute[]> {
  const out: TradeRoute[] = [];
  for (const [id, cfg] of chosenPool) {
    const inst = BY_ID.get(id);
    if (!inst || !trackedIds.has(id)) continue; // weth is internal, not a routed market
    const quote = QUOTE_META[cfg.quote];
    out.push({
      instrumentId: id,
      symbol: inst.symbol,
      pool: cfg.pool,
      fee: await poolFee(cfg.pool),
      quoteId: cfg.quote,
      quoteSymbol: quote.symbol,
      quoteToken: quote.token,
      quoteDecimals: quote.decimals,
      baseToken: inst.tokenAddress!,
      baseDecimals: BASE_DECIMALS[id]!,
    });
  }
  return out;
}

// ---- Entry -----------------------------------------------------------------------------

export function startChainData() {
  if (!config.chainEnabled) {
    console.log('[chain] KOVRA_CHAIN_ENABLED=false, onchain data disabled');
    return;
  }
  console.log(`[chain] connecting Robinhood Chain ws=${config.chainWsUrl}`);
  connect();
  // Dead-socket watchdog: chain events arrive multiple times per second, so a
  // full minute of silence while "connected" means a half-open socket, recycle it.
  setInterval(
    () => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const s = getChainStatusAgeMs();
      if (s !== null && s > 60_000) {
        console.warn('[chain] no frames for 60s, recycling dead socket');
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

/** ms since the last chain frame, from store status, null when never connected. */
function getChainStatusAgeMs(): number | null {
  const at = getChainLastEventAt();
  return at ? Date.now() - Date.parse(at) : null;
}
