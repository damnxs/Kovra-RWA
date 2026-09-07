import type { Response } from 'express';
import { config, missingKey } from './config.js';
import { BY_SYMBOL, ALL_INSTRUMENTS, ONCHAIN_IDS, BY_ID } from './registry.js';
import { sessionFor, type MarketSession } from './session.js';
import type { Quote, Status, HistoryPoint, OnchainEvent } from '../src/types/quote.js';

// ---- State -----------------------------------------------------------------

const quotes = new Map<string, Quote>();
const points = new Map<string, HistoryPoint[]>(); // since-connection rings
const prevClose = new Map<string, string>();
const sseClients = new Set<Response>();
const dirty = new Set<string>();
const onchainRing: OnchainEvent[] = []; // newest-first live onchain feed

const MAX_POINTS = 720;
const BROADCAST_MS = 250;
const STALE_AFTER_MS = 90_000;
const MAX_ONCHAIN_EVENTS = 200;

let status: Status = {
  provider: config.provider,
  transport: 'none',
  connected: false,
  lastEventAt: null,
  rateLimitedUntil: null,
  missingKey,
  demo: config.demoMode,
  upstreamError: null,
  serverTime: new Date().toISOString(),
  chain: {
    chainId: 4663,
    name: 'Robinhood Chain',
    connected: false,
    blockNumber: null,
    lastEventAt: null,
  },
};

export function getStatus(): Status {
  return { ...status, serverTime: new Date().toISOString() };
}

export function patchStatus(p: Partial<Status>) {
  status = { ...status, ...p };
  broadcastStatus();
}

// ---- Quote intake ----------------------------------------------------------

/** Accept a normalized quote; drops same-price repeats (honest motion). */
function putQuote(q: Quote): boolean {
  const prev = quotes.get(q.instrumentId);
  if (prev && prev.price === q.price && prev.mode === q.mode) return false;
  if (!points.has(q.instrumentId)) points.set(q.instrumentId, []);
  quotes.set(q.instrumentId, q);
  const ring = points.get(q.instrumentId);
  if (ring) {
    ring.push({ t: Date.parse(q.sourceTimestamp), p: q.price });
    if (ring.length > MAX_POINTS) ring.splice(0, ring.length - MAX_POINTS);
  }
  dirty.add(q.instrumentId);
  scheduleBroadcast();
  return true;
}

function withSession(q: Quote): Quote {
  q.session = sessionFor(new Date());
  return q;
}

/** REST /quote snapshot for one symbol. t is in seconds. */
export function applyRestQuote(symbol: string, c: number, pc: number, dp: number | null, tSec: number) {
  const inst = BY_SYMBOL.get(symbol);
  if (!inst) return;
  const receivedAt = new Date();
  const sourceMs = tSec * 1000;
  if (pc > 0) prevClose.set(inst.id, String(pc));
  const cachedPc = prevClose.get(inst.id) ?? null;
  const changePct = dp !== null ? dp : cachedPc ? ((c - Number(cachedPc)) / Number(cachedPc)) * 100 : null;
  putQuote(
    withSession({
      instrumentId: inst.id,
      price: String(c),
      currency: inst.currency,
      provider: config.provider,
      sourceTimestamp: new Date(sourceMs).toISOString(),
      receivedAt: receivedAt.toISOString(),
      mode: 'snapshot',
      delaySeconds: Math.max(0, Math.round((receivedAt.getTime() - sourceMs) / 1000)),
      session: 'unknown',
      previousClose: cachedPc,
      changePct,
    }),
  );
}

/** One live trade from the WS feed. t is in milliseconds. */
export function applyTrade(symbol: string, price: number, tMs: number) {
  const inst = BY_SYMBOL.get(symbol);
  if (!inst || !Number.isFinite(price) || price <= 0) return;
  const receivedAt = new Date();
  const cachedPc = prevClose.get(inst.id);
  const changePct = cachedPc ? ((price - Number(cachedPc)) / Number(cachedPc)) * 100 : null;
  putQuote(
    withSession({
      instrumentId: inst.id,
      price: String(price),
      currency: inst.currency,
      provider: config.provider,
      sourceTimestamp: new Date(tMs).toISOString(),
      receivedAt: receivedAt.toISOString(),
      mode: 'realtime',
      delaySeconds: Math.max(0, Math.round((receivedAt.getTime() - tMs) / 1000)),
      session: 'unknown',
      previousClose: cachedPc ?? null,
      changePct,
    }),
  );
  status.lastEventAt = receivedAt.toISOString();
}

/** WS ping frame — liveness only, never a price event. */
export function touchLastEvent() {
  status.lastEventAt = new Date().toISOString();
}

// ---- Onchain intake (Robinhood Chain) -------------------------------------------

/** One real onchain price observation (Uniswap pool). Anchor = first price seen. */
export function applyOnchainQuote(
  instrumentId: string,
  price: number,
  previousClose: string,
  changePct: number,
  sourceTimestamp: string,
  provider = 'robinhood-chain',
) {
  const inst = BY_ID.get(instrumentId);
  if (!inst) return;
  const receivedAt = new Date().toISOString();
  putQuote({
    instrumentId,
    price: String(price),
    currency: inst.currency,
    provider,
    sourceTimestamp,
    receivedAt,
    mode: 'realtime',
    delaySeconds: 0,
    session: 'open', // onchain markets run 24/7 — a calendar session does not apply
    previousClose,
    changePct,
  });
}

/** Append real onchain events to the live ring and fan out over SSE. */
export function pushOnchainEvents(events: OnchainEvent[]) {
  onchainRing.unshift(...events);
  if (onchainRing.length > MAX_ONCHAIN_EVENTS) onchainRing.length = MAX_ONCHAIN_EVENTS;
  const payload = JSON.stringify({ events });
  for (const res of sseClients) res.write(`event: onchain\ndata: ${payload}\n\n`);
}

export function getOnchainEvents(): OnchainEvent[] {
  return onchainRing;
}

/** Patch the chain section of the status and rebroadcast. */
export function patchChainStatus(p: Partial<Status['chain']>) {
  status.chain = { ...status.chain, ...p };
  broadcastStatus();
}

export function chainUsable(): boolean {
  return status.chain.connected;
}

export function getChainLastEventAt(): string | null {
  return status.chain.lastEventAt;
}

export function getQuotes(): Quote[] {
  return ALL_INSTRUMENTS.map((i) => quotes.get(i.id)).filter((q): q is Quote => !!q);
}

export function getQuote(id: string): Quote | undefined {
  return quotes.get(id);
}

export function getPoints(id: string): HistoryPoint[] {
  return points.get(id) ?? [];
}

/** Milliseconds since the last upstream frame (trade or ping); Infinity when none. */
export function msSinceLastEvent(): number {
  return status.lastEventAt ? Date.now() - Date.parse(status.lastEventAt) : Infinity;
}

export function isRateLimited(): boolean {
  return !!status.rateLimitedUntil && Date.parse(status.rateLimitedUntil) > Date.now();
}

/** Set/clear the upstream error only on change; each change broadcasts status. */
export function setUpstreamError(err: string | null) {
  if (status.upstreamError === err) return;
  patchStatus({ upstreamError: err });
}

export function isAuthRejected(): boolean {
  return status.upstreamError === 'auth-rejected';
}

/**
 * Stale is its own axis (technical.md L83): only meaningful while the transport
 * is live and the session is open — but never implied by mode, price, or a
 * mere connected flag. Exported pure for check scripts.
 */
export function computeStale(
  lastSeenMs: number,
  transport: Status['transport'],
  session: MarketSession,
  nowMs: number,
): boolean {
  return transport === 'live' && session === 'open' && nowMs - lastSeenMs > STALE_AFTER_MS;
}

export function setRateLimited(seconds: number) {
  patchStatus({ rateLimitedUntil: new Date(Date.now() + seconds * 1000).toISOString() });
}

// ---- Stale + session re-stamp sweep (orthogonal axis) ------------------------

function sweep() {
  let changed = false;
  // ponytail: demo forces a simulated open session so the labeled simulator
  // isn't contradicted by the real calendar; real mode always uses the calendar.
  const session = config.demoMode ? ('open' as const) : sessionFor(new Date());
  const chainLast = status.chain.lastEventAt ? Date.parse(status.chain.lastEventAt) : 0;
  for (const q of quotes.values()) {
    if (ONCHAIN_IDS.has(q.instrumentId)) {
      // Onchain instruments: market is open 24/7; staleness is driven by the
      // chain connection, not the TradFi session calendar.
      const onchainStale = status.chain.connected && chainLast > 0 && Date.now() - chainLast > STALE_AFTER_MS;
      if (q.session !== 'open' || q.stale !== onchainStale) {
        q.session = 'open';
        q.stale = onchainStale;
        changed = true;
      }
      continue;
    }
    if (q.session !== session) {
      q.session = session;
      changed = true;
    }
    const lastSeen = Math.max(
      Date.parse(q.receivedAt),
      status.lastEventAt ? Date.parse(status.lastEventAt) : 0,
    );
    const stale = computeStale(lastSeen, status.transport, session, Date.now());
    if (q.stale !== stale) {
      q.stale = stale;
      changed = true;
    }
  }
  if (changed) {
    for (const q of quotes.values()) dirty.add(q.instrumentId);
    scheduleBroadcast();
  }
}

// ---- SSE fan-out -------------------------------------------------------------

function sseSend(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

let broadcastTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleBroadcast() {
  if (broadcastTimer) return;
  broadcastTimer = setTimeout(() => {
    broadcastTimer = null;
    const changedQuotes = [...dirty]
      .map((id) => quotes.get(id))
      .filter((q): q is Quote => !!q);
    dirty.clear();
    if (changedQuotes.length === 0) return;
    const payload = JSON.stringify({ quotes: changedQuotes });
    for (const res of sseClients) res.write(`event: quotes\ndata: ${payload}\n\n`);
  }, BROADCAST_MS);
}

export function broadcastStatus() {
  const payload = JSON.stringify(getStatus());
  for (const res of sseClients) res.write(`event: status\ndata: ${payload}\n\n`);
}

export function addSseClient(res: Response) {
  sseClients.add(res);
  console.log(`[sse] client connected (${sseClients.size} total)`);
  res.write('retry: 3000\n\n');
  sseSend(res, 'init', {
    quotes: getQuotes(),
    status: getStatus(),
    history: Object.fromEntries(ALL_INSTRUMENTS.map((i) => [i.id, getPoints(i.id)])),
    onchain: getOnchainEvents().slice(0, 50),
  });
  res.on('close', () => {
    sseClients.delete(res);
    console.log(`[sse] client disconnected (${sseClients.size} total)`);
  });
}

// ---- Heartbeat + sweep timers -------------------------------------------------

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let sweepTimer: ReturnType<typeof setInterval> | null = null;

export function startTimers() {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    for (const res of sseClients) res.write(`: heartbeat ${Date.now()}\n\n`);
  }, 20_000);
  sweepTimer = setInterval(sweep, 10_000);
}

export function stopTimers() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  if (sweepTimer) clearInterval(sweepTimer);
  heartbeatTimer = sweepTimer = null;
}

// ---- Demo mode (isolated, static, labeled; never mixed with live upstream) ----

const DEMO_FIXTURES: Array<[symbol: string, price: number, prevClose: number]> = [
  ['SPY', 612.34, 610.02],
  ['QQQ', 504.12, 507.5],
  ['XLE', 84.56, 83.41],
  ['XLF', 48.9, 49.03],
  ['XLV', 92.45, 92.45],
];

/**
 * Demo mode under DEMO_MODE=true: an explicitly labeled simulation. Ticks are
 * synthetic random-walk steps — visible motion for keyless demos only, always
 * marked provider 'simulated' + status.demo, never mixed with live upstream
 * quotes and never presented as live data (technical.md honest-motion rule).
 */
export function seedDemoQuotes() {
  const now = new Date();
  for (const [symbol, price, pc] of DEMO_FIXTURES) {
    const inst = BY_SYMBOL.get(symbol);
    if (!inst) continue;
    quotes.set(inst.id, {
      instrumentId: inst.id,
      price: String(price),
      currency: inst.currency,
      provider: 'simulated',
      sourceTimestamp: now.toISOString(),
      receivedAt: now.toISOString(),
      mode: 'snapshot',
      delaySeconds: 0,
      session: 'open', // simulated session; the whole feed is labeled simulated
      previousClose: String(pc),
      changePct: ((price - pc) / pc) * 100,
      stale: false,
    });
  }
  status.missingKey = false;
  status.upstreamError = null;
}

const SIM_TICK_MS = 3_000;
let simTimer: ReturnType<typeof setInterval> | null = null;

/** Gentle simulated motion: ±0.1% random-walk per instrument per tick. */
export function startDemoSimulation() {
  if (simTimer || !config.demoMode) return;
  simTimer = setInterval(() => {
    const now = new Date().toISOString();
    for (const [symbol, , pc] of DEMO_FIXTURES) {
      const inst = BY_SYMBOL.get(symbol);
      const q = inst && quotes.get(inst.id);
      if (!inst || !q) continue;
      const step = (Math.random() - 0.5) * 0.002; // synthetic motion, demo only
      const price = Number(Math.max(0.01, Number(q.price) * (1 + step)).toFixed(2));
      if (price === Number(q.price)) continue; // no move, no event
      putQuote({
        instrumentId: inst.id,
        price: String(price),
        currency: inst.currency,
        provider: 'simulated',
        sourceTimestamp: now,
        receivedAt: now,
        mode: 'snapshot',
        delaySeconds: 0,
        session: 'open', // simulated session — matches seedDemoQuotes/sweep
        previousClose: String(pc),
        changePct: ((price - pc) / pc) * 100,
      });
    }
  }, SIM_TICK_MS);
}

export function stopDemoSimulation() {
  if (!simTimer) return;
  clearInterval(simTimer);
  simTimer = null;
}
