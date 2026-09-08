import type { Response } from 'express';
import { ALL_INSTRUMENTS, BY_ID } from './registry.js';
import type { Quote, Status, HistoryPoint, OnchainEvent, OnchainStats, ChainLogEntry } from '../src/types/quote.js';

// ---- State -----------------------------------------------------------------

const quotes = new Map<string, Quote>();
const points = new Map<string, HistoryPoint[]>(); // since-connection rings
const sseClients = new Set<Response>();
const dirty = new Set<string>();
const onchainRing: OnchainEvent[] = []; // newest-first live onchain feed

const MAX_POINTS = 720;
const BROADCAST_MS = 250;
const STALE_AFTER_MS = 90_000;
const MAX_ONCHAIN_EVENTS = 200;

const status: Status = {
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

// ---- Quote intake ----------------------------------------------------------

/** Accept a normalized quote; drops same-price repeats (honest motion). */
function putQuote(q: Quote): boolean {
  const prev = quotes.get(q.instrumentId);
  if (prev && prev.price === q.price) return false;
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
  putQuote({
    instrumentId,
    price: String(price),
    currency: inst.currency,
    provider,
    sourceTimestamp,
    receivedAt: new Date().toISOString(),
    previousClose,
    changePct,
  });
}

/** Merge real historical points into a ring without touching the live quote. */
export function seedHistory(id: string, pts: HistoryPoint[]) {
  if (pts.length === 0) return;
  const ring = points.get(id) ?? [];
  const merged = [...ring, ...pts].sort((a, b) => a.t - b.t);
  points.set(id, merged.length > MAX_POINTS ? merged.slice(-MAX_POINTS) : merged);
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

// ---- Live chain log ------------------------------------------------------------

const chainLog: ChainLogEntry[] = []; // newest-first
const MAX_CHAIN_LOG = 120;

/** Push one real chain event to the live log ring and fan it out over SSE. */
export function pushChainLog(e: ChainLogEntry) {
  chainLog.unshift(e);
  if (chainLog.length > MAX_CHAIN_LOG) chainLog.length = MAX_CHAIN_LOG;
  const payload = JSON.stringify({ log: [e] });
  for (const res of sseClients) res.write(`event: chainlog\ndata: ${payload}\n\n`);
}

export function getChainLog(): ChainLogEntry[] {
  return chainLog;
}

// ---- Onchain stats fan-out -----------------------------------------------------

let statsSnap: OnchainStats = {};
let statsDirty = false;

/**
 * Swap counters/TVL changed. Coalesced onto the existing SSE batch (≤250ms):
 * clients get stats as a push on the 'onchain' event instead of polling.
 */
export function pushOnchainStats(stats: OnchainStats) {
  statsSnap = stats;
  statsDirty = true;
  scheduleBroadcast();
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

export function getPoints(id: string): HistoryPoint[] {
  return points.get(id) ?? [];
}

// ---- Stale sweep -------------------------------------------------------------------

/**
 * Onchain markets run 24/7, so staleness is purely a chain-connection axis:
 * connected but silent for STALE_AFTER_MS means the feed itself is stuck.
 */
function sweep() {
  const chainLast = status.chain.lastEventAt ? Date.parse(status.chain.lastEventAt) : 0;
  const stale = status.chain.connected && chainLast > 0 && Date.now() - chainLast > STALE_AFTER_MS;
  let changed = false;
  for (const q of quotes.values()) {
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
    if (changedQuotes.length > 0) {
      const payload = JSON.stringify({ quotes: changedQuotes });
      for (const res of sseClients) res.write(`event: quotes\ndata: ${payload}\n\n`);
    }
    if (statsDirty) {
      statsDirty = false;
      const payload = JSON.stringify({ events: [], stats: statsSnap });
      for (const res of sseClients) res.write(`event: onchain\ndata: ${payload}\n\n`);
    }
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
    chainLog: getChainLog().slice(0, 60),
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
