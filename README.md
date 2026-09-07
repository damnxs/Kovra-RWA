# Kovra — public homepage

Market-discovery frontend for an onchain RWA platform under development. Shows a
small verified universe of five US ETF proxies (SPY, QQQ, XLE, XLF, XLV) with
honest sourcing: real prices only, timestamps for source and receipt, and no
fabricated history. Nothing here is tradable, and nothing is investment advice.

## Stack

- Vite + React 18 + TypeScript (strict)
- Tailwind CSS v4 (CSS-first `@theme`, tokens from `style.md`)
- React Router (routes `/`, `/markets`, `/markets/:id`, `/about`, `/dashboard`)
- recharts (since-connection sparklines and detail charts)
- Express API server in `server/` — holds the Finnhub key server-side, never in
  the browser bundle; SSE fan-out; Node 22 global WebSocket (no `ws` dependency)

## Setup

```bash
npm install
cp .env.example .env
# fill in FINNHUB_API_KEY (free key from https://finnhub.io)
```

Without a key the app still runs: the UI shows a public-safe "market data is
unavailable" state and the registry remains browsable.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Express (`tsx watch`) on :8787 + Vite on :5173 (proxies `/api`) |
| `npm run dev:server` / `dev:client` | either half alone |
| `npm run build` | typecheck-then-build client into `dist/` |
| `npm start` | production: Express on :8787 serving `dist/` + API |
| `npm run typecheck` | `tsc --noEmit` over `src/` and `server/` |
| `npm run check:session` | runnable check of ET session/holiday/DST math |
| `npm run check:stale` | runnable check of the stale-detection axis (7 cases) |
| `npm run check:reliability` | offline stub harness: 429/backoff/reconnect/demo/SSE fan-out (~5 min) |

## Architecture

```
server/
  config.ts    env parsing (5 vars from technical.md)
  registry.ts  instrument registry — stable ids, proxy labels, tradable:false
  session.ts   ET market session via Intl America/New_York + static 2026 NYSE holidays
  finnhub.ts   REST /quote bootstrap + WS trades; backoff+jitter reconnect;
               server-global 15s poll fallback after 3 WS failures; 429 handling
  store.ts     normalized quote cache, since-connection point rings (cap 720),
               SSE fan-out (batched ~250ms, price-changed only), stale sweep,
               isolated demo fixtures
  routes.ts    GET /api/markets /api/quotes /api/stream (SSE) /api/history
src/
  types/quote.ts        shared contracts (Quote is exactly technical.md L67-81)
  data/MarketProvider   single client data path: EventSource + poll fallback
  data/WalletProvider   minimal EIP-1193 injected-wallet connect (identity only, no SDK)
  data/useWatchlist     localStorage watchlist (guarded)
  lib/format.ts         price/pct/time/"Updated Xs ago"
  lib/agent.ts          deterministic concentration + movers (pure functions)
  components/ pages/    editorial UI per style.md — no sidebar, no dashboard
```

Data flow: server holds one upstream subscription per instance and fans out
normalized quotes over SSE (`init` / `quotes` / `status`, heartbeat every 20s).
The browser holds one EventSource; it never polls per visitor.

## Verified vs. not verified

Verified:

- `npm install`, `npm run typecheck`, `npm run build` clean.
- Missing-key run: homepage renders the public-safe state, `/api/markets`
  returns the registry, SSE responds with `init` and the missing-key status.
- Session math (DST, weekends, 2026 NYSE holidays incl. Labor Day) via
  `npm run check:session`.
- Honest-motion audit: no `Math.random`/synthetic ticks anywhere in price paths
  (the only random use is WS reconnect jitter in `server/finnhub.ts`).
- Built `dist/` contains no provider key (server-only env).

Not verified during this build:

- A live tick observed in an open session (build day was Labor Day, NYSE
  closed). WS trade handling is implemented per Finnhub's documented frame
  shape (`trade` with `data[].p`/`data[].t`, `ping` frames) and observed
  frames, but open-session streaming should be re-observed on a trading day.

## Wallet & dashboard

The public site stays discovery-first. "Connect wallet" (secondary nav action) does a
real EIP-1193 connection to an injected wallet, then routes to `/dashboard` (fade
transition, connecting state, dashboard opens on completion). Disconnect actually
holds: it best-effort revokes the wallet-side `eth_accounts` permission
(`wallet_revokePermissions`, MetaMask-and-friends) and sets a local flag that
suppresses the silent `eth_accounts` restore on reload until the user explicitly
reconnects. On the dashboard:
connected identity, Robinhood Chain network status (labelled *integration pending* —
the wallet's actual network is shown separately, never claimed as Robinhood Chain),
My Exposure and onchain activity as honest empty states ("Coming soon"), and the
watchlist. There is no Buy action anywhere until verified token contracts,
liquidity, and transaction routes exist — surfaces link to market references with
"View exposure"/"Explore markets" instead. The journey — Discover → Understand →
Connect → Access → Track — is laid out in the homepage's "How Kovra works" section.

## Limitations

- History: `/stock/candle` is premium-only and never called. Charts show the
  since-connection series with that label, or an honest placeholder.
- Redistribution/public-display rights for Finnhub free data are unresolved —
  `PUBLIC_DISPLAY_APPROVED=false` by default; see `public/docs/provider-assessment.md`
  (served at `/docs/provider-assessment.md`).
- All instruments are reference proxies, `tradable: false`, and shown with
  proxy labels; an ETF price is never presented as an index level.
- No Robinhood/Robinhood Chain affiliation or verified asset integration.
- Ops: the Finnhub free tier appears to allow **one active WebSocket per key** —
  two server instances sharing a key will keep disconnecting each other. Run one
  server instance per key.
- `DEMO_MODE=true` serves a clearly labeled simulation: prices move (small
  random-walk ticks every 3s) but every surface shows "Simulated data — not
  real prices"; it never contacts upstream and never mixes with the live cache.
  Set `DEMO_MODE=false` for real Finnhub data.
