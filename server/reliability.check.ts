// Offline reliability checks against local stubs — zero real Finnhub contact.
// Run: npm run check:reliability   (~4 minutes; timing-sensitive by design)
//
// Covers: missing-key (zero upstream, SSE init status), invalid-key 401
// (upstream error, no fake data, no request storm), 429 (Retry-After honored,
// loop paused, cache keeps serving, status broadcast), WS failure → poll
// fallback, request-budget invariance across SSE clients, recovery stopping
// the loop, reconcile-before-resubscribe, DEMO_MODE zero-upstream.
import http from 'node:http';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

const SERVER_PORT = 8890;
const REST_PORT = 8891;
const WS_PORT = 8892;
const REST_BASE = `http://127.0.0.1:${REST_PORT}`;
const API = `http://127.0.0.1:${SERVER_PORT}`;

let failures = 0;
function check(ok: boolean, label: string, extra = '') {
  if (!ok) failures++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${extra ? ` — ${extra}` : ''}`);
}
function section(name: string) {
  console.log(`\n== ${name}`);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---- REST stub ----------------------------------------------------------------

type Mode = 'ok' | 'vary' | '429' | '401';
const rest = { mode: 'ok' as Mode, hits: 0, hitTimes: [] as number[] };

const restServer = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/__mode') {
    let body = '';
    req.on('data', (c: Buffer) => (body += c));
    req.on('end', () => {
      rest.mode = JSON.parse(body) as Mode;
      res.writeHead(204).end();
    });
    return;
  }
  rest.hits++;
  rest.hitTimes.push(Date.now());
  if (rest.mode === '429') {
    res.writeHead(429, { 'retry-after': '120' }).end();
    return;
  }
  if (rest.mode === '401') {
    res.writeHead(401, { 'content-type': 'application/json' }).end('{"error":"Invalid API key"}');
    return;
  }
  const c = rest.mode === 'vary' ? 100 + rest.hits : 100; // 'vary' changes price each hit
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ c, pc: 99, dp: 1.01, t: Math.floor(Date.now() / 1000) }));
});

async function setMode(mode: Mode) {
  await fetch(`${REST_BASE}/__mode`, { method: 'POST', body: JSON.stringify(mode) });
}

// ---- WS stub (accepts upgrades; logs subscribe frames with timestamps) --------

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const wsStub = { total: 0, frames: [] as Array<{ t: number; text: string }>, server: null as http.Server | null, sockets: new Set<import('node:stream').Duplex>() };

function startWsStub() {
  const server = http.createServer();
  server.on('upgrade', (req, socket) => {
    const key = String(req.headers['sec-websocket-key'] ?? '');
    const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
    socket.write(
      `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`,
    );
    wsStub.total++;
    wsStub.sockets.add(socket);
    socket.on('data', (buf: Buffer) => {
      // Unmask small client text frames (subscribe messages) — RFC6455.
      // Several frames may coalesce into one data event; parse them all.
      let pos = 0;
      while (pos + 2 <= buf.length) {
        const len7 = buf[pos + 1]! & 0x7f;
        let off = pos + 2;
        let plen = len7;
        if (len7 === 126) {
          plen = buf.readUInt16BE(pos + 2);
          off = pos + 4;
        } else if (len7 === 127) {
          plen = Number(buf.readBigUInt64BE(pos + 2));
          off = pos + 10;
        }
        const mask = buf.subarray(off, off + 4);
        const payload = Buffer.alloc(plen);
        for (let i = 0; i < plen; i++) payload[i] = buf[off + 4 + i]! ^ mask[i % 4]!;
        wsStub.frames.push({ t: Date.now(), text: payload.toString() });
        pos = off + 4 + plen;
      }
    });
    socket.on('close', () => wsStub.sockets.delete(socket));
  });
  server.listen(WS_PORT, '127.0.0.1');
  wsStub.server = server;
}

function stopWsStub() {
  if (!wsStub.server) return;
  wsStub.server.close();
  for (const s of wsStub.sockets) s.destroy();
  wsStub.sockets.clear();
  wsStub.server = null;
}

// ---- Spawned Kovra server ------------------------------------------------------

type Child = ReturnType<typeof spawn>;
let child: Child | null = null;
const serverLog: string[] = [];

function startServer(envOver: Record<string, string>) {
  serverLog.length = 0;
  // Stubs are shared across scenarios — count only this server's traffic.
  rest.hits = 0;
  rest.hitTimes.length = 0;
  wsStub.total = 0;
  wsStub.frames.length = 0;
  child = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
    env: {
      ...process.env,
      PORT: String(SERVER_PORT),
      MARKET_DATA_PROVIDER: 'finnhub',
      FINNHUB_API_KEY: 'dummy-key',
      FINNHUB_API_BASE: REST_BASE,
      FINNHUB_WS_URL: `ws://127.0.0.1:${WS_PORT}`,
      DEMO_MODE: 'false',
      ...envOver,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const pump = (d: Buffer) => {
    for (const line of String(d).split('\n')) {
      if (!line) continue;
      serverLog.push(line);
      console.log(`      [server] ${line}`);
    }
  };
  child.stdout!.on('data', pump);
  child.stderr!.on('data', pump);
}

async function stopServer() {
  const c = child;
  if (!c) return;
  child = null;
  c.kill('SIGTERM');
  await new Promise((r) => {
    c.on('exit', r);
    setTimeout(r, 3000);
  });
}

type ApiSnapshot = { quotes: Array<Record<string, unknown>>; status: Record<string, unknown> };

async function waitServer(timeoutMs = 15_000): Promise<ApiSnapshot> {
  const t0 = Date.now();
  for (;;) {
    try {
      const r = await fetch(`${API}/api/quotes`);
      if (r.ok) return (await r.json()) as ApiSnapshot;
    } catch {
      /* not up yet */
    }
    if (Date.now() - t0 > timeoutMs) throw new Error('server did not start');
    await sleep(250);
  }
}

async function waitStatus(pred: (s: Record<string, unknown>) => boolean, timeoutMs = 90_000): Promise<Record<string, unknown>> {
  const t0 = Date.now();
  for (;;) {
    const r = await fetch(`${API}/api/quotes`);
    const data = (await r.json()) as ApiSnapshot;
    if (pred(data.status)) return data.status;
    if (Date.now() - t0 > timeoutMs) throw new Error(`status timeout: ${JSON.stringify(data.status)}`);
    await sleep(500);
  }
}

// ---- SSE client -----------------------------------------------------------------

type Sse = { events: Array<{ event: string; data: string }>; comments: string[]; close: () => void };

async function sseConnect(): Promise<Sse> {
  const ac = new AbortController();
  const res = await fetch(`${API}/api/stream`, { signal: ac.signal, headers: { accept: 'text/event-stream' } });
  const out: Sse = { events: [], comments: [], close: () => ac.abort() };
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = '';
  void (async () => {
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf('\n\n')) >= 0) {
          const chunk = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          if (chunk.startsWith(':')) {
            out.comments.push(chunk);
            continue;
          }
          const ev = /^event: (.+)$/m.exec(chunk)?.[1];
          const da = /^data: (.+)$/m.exec(chunk)?.[1];
          if (ev && da) out.events.push({ event: ev, data: da });
        }
      }
    } catch {
      /* aborted */
    }
  })();
  return out;
}

// ---- Scenarios --------------------------------------------------------------------

async function missingKey() {
  section('missing key: homepage API up, SSE status, zero upstream, no secrets');
  startWsStub();
  startServer({ FINNHUB_API_KEY: '' });
  await waitServer();
  await sleep(3_000); // would-be upstream window
  check(rest.hits === 0, 'zero REST upstream attempts', `hits=${rest.hits}`);
  check(wsStub.total === 0, 'zero WS attempts', `total=${wsStub.total}`);

  const sse = await sseConnect();
  await sleep(500);
  const init = sse.events.find((e) => e.event === 'init');
  check(!!init, 'SSE init event received');
  const initStatus = init ? (JSON.parse(init.data) as { status: Record<string, unknown> }).status : null;
  check(initStatus?.missingKey === true, 'init carries missingKey status');

  const markets = await fetch(`${API}/api/markets`);
  const marketsData = (await markets.json()) as { instruments: unknown[] };
  check(markets.status === 200 && marketsData.instruments.length === 5, '/api/markets responds with registry');
  const q = await fetch(`${API}/api/quotes`);
  check(q.status === 200, '/api/quotes responds (no crash)');
  check(
    !serverLog.some((l) => /token/i.test(l)),
    'server logs never contain the word "token"',
  );
  sse.close();
  await sleep(300);
  check(serverLog.some((l) => l.includes('client disconnected (0 total)')), 'SSE client Set shrinks on disconnect');
  await stopServer();
  stopWsStub();
}

async function invalidKey() {
  section('invalid key: 401 → upstream error, no fake data, no request storm');
  await setMode('401');
  startServer({});
  await waitServer();
  await waitStatus((s) => s.upstreamError === 'auth-rejected');
  check(true, 'status conveys auth-rejected (upstreamError)');
  const snap = (await (await fetch(`${API}/api/quotes`)).json()) as ApiSnapshot;
  check(snap.quotes.length === 0, 'no fake quotes served');
  const hitsAfterBoot = rest.hits;
  await sleep(26_000); // long enough for ≥1 poll tick, which must be blocked by the auth guard
  check(rest.hits === hitsAfterBoot, 'auth rejection pauses REST polling (no 401 storm)', `hits=${rest.hits}`);
  await stopServer();
}

async function rateLimit() {
  section('429: Retry-After honored, loop pauses, cache serves, status broadcast');
  await setMode('ok');
  startServer({});
  await waitServer();
  await waitStatus((s) => s.transport === 'poll'); // WS port closed → 3 failures → poll
  check(true, 'WS failure ×3 → transport=poll fallback');

  const sse = await sseConnect();
  await sleep(300);
  const hitsBefore = rest.hits;
  await setMode('429');
  const t0 = Date.now();
  // Wait for the rate-limit status event on the live SSE connection.
  let rlEvent: string | null = null;
  while (Date.now() - t0 < 40_000) {
    await sleep(500);
    const e = sse.events.find(
      (e) => e.event === 'status' && typeof JSON.parse(e.data).rateLimitedUntil === 'string',
    );
    if (e) {
      rlEvent = (JSON.parse(e.data) as { rateLimitedUntil: string }).rateLimitedUntil;
      break;
    }
  }
  check(!!rlEvent, 'rate-limit status broadcast reaches SSE client');
  if (rlEvent) {
    const remainingS = (Date.parse(rlEvent) - Date.now()) / 1000;
    check(remainingS > 100, 'Retry-After: 120 honored (pause ≥ 60s default)', `remaining=${remainingS.toFixed(0)}s`);
  }
  const hitsAt429 = rest.hits;
  check(hitsAt429 - hitsBefore <= 2, 'only the triggering request fires (loop pauses immediately)', `delta=${hitsAt429 - hitsBefore}`);
  await sleep(20_000);
  check(rest.hits === hitsAt429, 'poll loop stays paused (no requests for 20s)');
  const snap = (await (await fetch(`${API}/api/quotes`)).json()) as ApiSnapshot;
  check(snap.quotes.length === 5, 'cache keeps serving quotes during rate limit');
  sse.close();
  await stopServer();
}

async function budgetRecovery() {
  section('budget/recovery: one loop for N clients, reconcile, recovery stops loop');
  await setMode('vary');
  startWsStub();
  startServer({});
  await waitServer();
  await waitStatus((s) => s.transport === 'live' && s.connected === true);
  check(true, 'WS connects → transport=live');

  await sleep(1_500); // let reconcile + subscribe settle
  check(rest.hits === 10, 'reconcile fired on open: 5 bootstrap + 5 snapshot refresh', `hits=${rest.hits}`);
  check(
    serverLog.some((l) => l.includes('reconciling snapshot before resubscribe')),
    'reconcile-before-resubscribe logged',
  );
  const subs = wsStub.frames.filter((f) => f.text.includes('"subscribe"'));
  check(subs.length === 5, '5 subscribe frames after reconcile', `frames=${subs.length}`);
  if (subs.length > 0 && rest.hitTimes.length > 0) {
    check(
      Math.min(...subs.map((f) => f.t)) >= rest.hitTimes[rest.hitTimes.length - 1]!,
      'subscribes happen only after the reconcile snapshot completes',
    );
  }

  // Kill the upstream socket path → reconnect failures → poll fallback.
  stopWsStub();
  await waitStatus((s) => s.transport === 'poll');
  check(true, 'upstream death → backoff failures → poll transport');

  // Two SSE clients, one server loop: 5 symbols / 15s regardless of client count.
  const a = await sseConnect();
  const b = await sseConnect();
  const hitsBefore = rest.hits;
  await sleep(32_000);
  const delta = rest.hits - hitsBefore;
  check(delta <= 15, 'REST budget invariant with 2 SSE clients (≤5 req/15s, not per-client)', `delta=${delta} in 32s`);
  check(a.events.some((e) => e.event === 'quotes') && b.events.some((e) => e.event === 'quotes'), 'quotes events fan out to both clients');
  check(a.comments.length >= 1 && b.comments.length >= 1, 'heartbeat comments reach both clients');

  // Upstream returns → WS opens again → poll loop stops.
  startWsStub();
  await waitStatus((s) => s.transport === 'live' && s.connected === true, 90_000);
  await sleep(2_000); // final reconcile settles
  const hitsRecovered = rest.hits;
  await sleep(20_000);
  check(rest.hits === hitsRecovered, 'recovery stops the poll loop (zero REST hits while live)');

  a.close();
  b.close();
  await sleep(500);
  check(serverLog.some((l) => l.includes('client disconnected (0 total)')), 'both SSE clients cleaned up');
  await stopServer();
  stopWsStub();
}

async function demo() {
  section('DEMO_MODE: fixtures served, zero upstream contact');
  startWsStub();
  startServer({ DEMO_MODE: 'true' });
  const snap = await waitServer();
  check(snap.status.demo === true, 'status.demo=true');
  check(
    snap.quotes.length === 5 && snap.quotes.every((q) => String(q.provider) === 'simulated'),
    'labeled simulated fixtures served (provider=simulated)',
  );
  const sse = await sseConnect();
  await sleep(8_000);
  check(rest.hits === 0, 'zero REST upstream attempts in demo', `hits=${rest.hits}`);
  check(wsStub.total === 0, 'zero WS upstream attempts in demo', `total=${wsStub.total}`);
  const init = sse.events.find((e) => e.event === 'init');
  check(!!init && (JSON.parse(init.data) as { status: { demo: boolean } }).status.demo === true, 'SSE init carries demo status');
  sse.close();
  await stopServer();
  stopWsStub();
}

// ---- Main ---------------------------------------------------------------------------

restServer.listen(REST_PORT, '127.0.0.1', async () => {
  try {
    await missingKey();
    await invalidKey();
    await rateLimit();
    await budgetRecovery();
    await demo();
  } catch (err) {
    failures++;
    console.error('UNEXPECTED ERROR:', err);
  } finally {
    await stopServer();
    stopWsStub();
    restServer.close();
    console.log(`\n${failures === 0 ? 'all reliability checks passed' : `${failures} RELIABILITY FAILURE(S)`}`);
    process.exit(failures === 0 ? 0 : 1);
  }
});
