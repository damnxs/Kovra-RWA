import { config, missingKey } from './config.js';
import { SYMBOLS } from './registry.js';
import { sessionFor } from './session.js';
import {
  applyRestQuote,
  applyTrade,
  touchLastEvent,
  patchStatus,
  getStatus,
  msSinceLastEvent,
  isRateLimited,
  isAuthRejected,
  setRateLimited,
  setUpstreamError,
  seedDemoQuotes,
  startDemoSimulation,
} from './store.js';

// ponytail: one adapter per provider; a Twelve Data adapter would be a sibling module.

const POLL_INTERVAL_MS = 15_000; // 5 symbols / 15s = 20 req/min, under the 60/min free cap
const DEAD_SOCKET_MS = 60_000;
const RECONCILE_GAP_MS = 60_000;
const HEALTHY_CONN_MS = 30_000; // an open socket that survives this counts as healthy

let ws: WebSocket | null = null;
let wsOpenedAt = 0;
let backoffMs = 1_000;
let consecutiveFailures = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let deadSocketTimer: ReturnType<typeof setInterval> | null = null;
let bootstrapping = false;

// ---- REST -------------------------------------------------------------------

async function fetchQuote(symbol: string): Promise<void> {
  if (isRateLimited() || isAuthRejected()) return; // no retry storms while paused
  try {
    const res = await fetch(`${config.finnhubApiBase}/quote?symbol=${symbol}&token=${config.finnhubApiKey}`);
    if (res.status === 401 || res.status === 403) {
      // Invalid or unentitled key — surface as upstream error, keep serving cache.
      setUpstreamError('auth-rejected');
      console.error(`[finnhub] quote ${symbol}: HTTP ${res.status} — key rejected or not entitled`);
      return;
    }
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('retry-after'));
      const pause = Math.max(60, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 60);
      setRateLimited(pause);
      console.warn(`[finnhub] rate limited — pausing upstream requests for ${pause}s`);
      return;
    }
    if (!res.ok) {
      console.error(`[finnhub] quote ${symbol}: HTTP ${res.status}`);
      return;
    }
    const data = (await res.json()) as { c?: number; pc?: number; dp?: number | null; t?: number };
    if (typeof data.c === 'number' && data.c > 0) {
      setUpstreamError(null); // a 2xx quote proves credentials work again
      applyRestQuote(symbol, data.c, data.pc ?? 0, data.dp ?? null, data.t ?? Math.floor(Date.now() / 1000));
    }
  } catch (err) {
    console.error(`[finnhub] quote ${symbol} failed:`, err instanceof Error ? err.message : err);
  }
}

/** One snapshot of every symbol. Also used to reconcile after a connection gap. */
async function bootstrap(): Promise<void> {
  if (bootstrapping) return;
  bootstrapping = true;
  try {
    await Promise.all(SYMBOLS.map((s) => fetchQuote(s)));
  } finally {
    bootstrapping = false;
  }
}

// ---- WebSocket ------------------------------------------------------------------

function subscribeAll() {
  if (!ws) return;
  for (const s of SYMBOLS) ws.send(JSON.stringify({ type: 'subscribe', symbol: s }));
}

function connectWs() {
  if (missingKey || config.demoMode) return;
  let sock: WebSocket;
  try {
    sock = new WebSocket(`${config.finnhubWsUrl}?token=${config.finnhubApiKey}`);
  } catch (err) {
    console.error('[finnhub] WS construct failed:', err instanceof Error ? err.message : err);
    scheduleReconnect();
    return;
  }
  ws = sock;
  wsOpenedAt = Date.now();
  const openedAt = wsOpenedAt;
  let gotFrame = false;
  let opened = false;
  let handledClose = false;

  const failOnce = () => {
    if (handledClose || ws !== sock) return; // ignore stale sockets from an earlier lifecycle
    handledClose = true;
    ws = null;
    if (gotFrame || Date.now() - openedAt > HEALTHY_CONN_MS) {
      consecutiveFailures = 0;
      backoffMs = 1_000;
    }
    patchStatus({ connected: false });
    scheduleReconnect();
  };

  sock.onopen = () => {
    opened = true;
    // Deliberately NOT resetting the backoff here: a provider can accept the
    // 101 handshake and then drop a bad token a moment later, which would
    // otherwise cycle reconnects at ~1s forever. Only proven-healthy
    // connections reset it (see onclose).
    stopPollLoop();
    patchStatus({ transport: 'live', connected: true });
    // Reconcile with a fresh snapshot after a long gap, then (re)subscribe.
    if (msSinceLastEvent() > RECONCILE_GAP_MS) {
      console.log('[finnhub] connection gap >60s — reconciling snapshot before resubscribe');
      bootstrap().finally(subscribeAll);
    } else {
      subscribeAll();
    }
  };

  sock.onmessage = (ev: MessageEvent) => {
    gotFrame = true;
    setUpstreamError(null); // frames prove credentials work again
    let frame: { type?: string; data?: Array<{ s?: string; p?: number; t?: number }> };
    try {
      frame = JSON.parse(String(ev.data));
    } catch {
      return;
    }
    if (frame.type === 'trade' && Array.isArray(frame.data)) {
      // Per symbol, keep the last item of the batch.
      const last = new Map<string, { p: number; t: number }>();
      for (const t of frame.data) {
        if (t.s && typeof t.p === 'number' && typeof t.t === 'number') last.set(t.s, { p: t.p, t: t.t });
      }
      for (const [symbol, { p, t }] of last) applyTrade(symbol, p, t);
    } else if (frame.type === 'ping') {
      touchLastEvent();
    }
  };

  sock.onclose = failOnce;

  sock.onerror = () => {
    // Undici fires error but never close when the connection is refused or the
    // host is unreachable — treat a pre-open error as a failed attempt so the
    // backoff/poll fallback still engages. Post-open errors are followed by close.
    if (!opened) failOnce();
  };
}

function jitter(ms: number): number {
  const spread = ms * 0.3;
  return Math.round(ms + (Math.random() * 2 - 1) * spread); // reconnect jitter only — never touches prices
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  consecutiveFailures++;
  if (consecutiveFailures >= 3) startPollLoop();
  const wait = jitter(Math.min(backoffMs, 30_000));
  backoffMs = Math.min(backoffMs * 2, 30_000);
  console.warn(`[finnhub] WS reconnect #${consecutiveFailures} in ${wait}ms`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectWs();
  }, wait);
}

// Dead-socket watchdog: no frames for 60s while "connected" → terminate + reconnect.
// Only meaningful while the session is open — outside market hours a quiet feed
// is normal (Finnhub sends no keepalive pings), and recycling a healthy socket
// there just churns reconnects. Two open-session cases: frames used to flow and
// stopped (lastEventAt age), or the connection never framed at all (60s from
// open — a silent half-open socket must not block data forever).
function startDeadSocketWatch() {
  if (deadSocketTimer) return;
  deadSocketTimer = setInterval(() => {
    if (!ws || sessionFor(new Date()) !== 'open') return;
    const everFramed = getStatus().lastEventAt !== null;
    const dead = everFramed ? msSinceLastEvent() > DEAD_SOCKET_MS : Date.now() - wsOpenedAt > DEAD_SOCKET_MS;
    if (!dead) return;
    console.warn('[finnhub] no frames for 60s — terminating dead socket');
    const sock = ws;
    ws = null;
    try {
      sock.close();
    } catch {
      /* fall through to terminate */
    }
    (sock as unknown as { terminate?: () => void }).terminate?.();
    patchStatus({ connected: false });
    scheduleReconnect();
  }, 15_000);
}

// ---- Server-global polling fallback (never per visitor) ---------------------------

function startPollLoop() {
  if (pollTimer || config.demoMode || missingKey) return;
  patchStatus({ transport: 'poll' });
  console.warn('[finnhub] WS failed 3x — server polling every 15s (20 req/min)');
  pollTimer = setInterval(() => {
    if (isRateLimited()) return; // pause loop, keep serving cache; no retry storms
    (async () => {
      // Sequential: stays inside per-second burst caps on slow networks.
      for (const s of SYMBOLS) await fetchQuote(s);
    })();
  }, POLL_INTERVAL_MS);
}

function stopPollLoop() {
  if (!pollTimer) return;
  clearInterval(pollTimer);
  pollTimer = null;
}

// ---- Entry -----------------------------------------------------------------------

export function startMarketData() {
  startDeadSocketWatch();
  if (config.demoMode) {
    seedDemoQuotes();
    startDemoSimulation();
    console.log('[market-data] DEMO_MODE=true — labeled simulation (not real prices), no upstream contact');
    return;
  }
  if (missingKey) {
    patchStatus({ missingKey: true, transport: 'none', connected: false });
    console.warn('[market-data] FINNHUB_API_KEY not set — serving missing-key state (see .env.example)');
    return;
  }
  console.log(`[market-data] provider=${config.provider} mode=${config.mode} universe=${SYMBOLS.join(',')}`);
  bootstrap().finally(() => connectWs());
}
