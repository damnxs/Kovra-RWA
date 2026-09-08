# Kovra — public homepage

Market-discovery frontend for an onchain RWA platform under development. Shows a
small verified universe of eleven ERC-20 instruments on Robinhood Chain
(tokenized equities, a private-asset token, WETH, USDG) with honest sourcing:
real pool prices only, timestamps for source and receipt, and no fabricated
history. Nothing here is tradable, and nothing is investment advice.

## Stack

- Vite + React 18 + TypeScript (strict)
- Tailwind CSS v4 (CSS-first `@theme`, tokens from `style.md`)
- React Router (routes `/`, `/markets`, `/markets/:id`, `/trade/:id`, `/watchlist`,
  `/agent`, `/activity`, `/about`, `/dashboard`, `/docs`)
- recharts (since-connection sparklines and detail charts)
- Express API server in `server/`
- One server-side raw-JSON-RPC WebSocket to a Robinhood Chain test node — the
  single data source, no market-data API, no ethers/web3/viem dependency

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Express (`tsx watch`) on :8787 + Vite on :5173 (proxies `/api`) |
| `npm run dev:server` / `dev:client` | either half alone |
| `npm run build` | typecheck-then-build client into `dist/` |
| `npm start` | production: Express on :8787 serving `dist/` + API |
| `npm run typecheck` | `tsc --noEmit` over `src/` and `server/` |
| `npm run check:chain` | live sanity check of the onchain pricing + TVL path (needs the node reachable) |

## Architecture

```
server/
  config.ts    env parsing (.env.example lists every var, all KOVRA_CHAIN_*)
  registry.ts  instrument registry — 11 onchain tokens, all tradable:false
  chain.ts     one raw-JSON-RPC WS to the Robinhood Chain test node (chainId 4663):
               Uniswap V3 pool Swap-event pricing (sane-price band, then busiest
               pool), weth-quoted cross-rates, usdg at $1 issuer peg; ERC-20
               transfer feed; pool TVL recomputed on liquidity events
               (Mint/Burn/Collect) over the same WS — no polling; Nitro quirk
               handled (eth_blockNumber takes no params)
  store.ts     normalized quote cache, since-connection point rings (cap 720),
               SSE fan-out (batched ~250ms, price-changed only; stats ride the
               same batch as 'onchain' messages), stale sweep
  routes.ts    GET /api/markets /api/quotes /api/stream (SSE) /api/history
               /api/onchain/feed (SSE) /api/onchain/balances /api/onchain/transfers
src/
  types/quote.ts        shared client/server contracts
  data/MarketProvider   quote path: initial REST + 60s refresh fallback
  data/OnchainProvider  transfer feed + swap/TVL stats via SSE push (no polling)
  data/WalletProvider   minimal EIP-1193 injected-wallet connect (identity only, no SDK)
  data/useWatchlist     localStorage watchlist (guarded)
  lib/format.ts         price/pct/time/"Updated Xs ago"
  lib/agent.ts          deterministic concentration + movers (pure functions)
  pages/                Home Markets MarketDetail Trade Watchlist Agent
                        Activity Dashboard About Docs
  components/           editorial UI per style.md
```

Data flow: the server holds one WS connection to the chain node and fans out
normalized quotes, transfers, and swap/TVL stats over SSE (`init` / `quotes` /
`onchain` / `status`, heartbeat every 20s). The browser holds one EventSource;
it never polls per visitor. The 60-second client refresh is a same-origin
fallback round-trip, not an external call.

## Verified vs. not verified

Verified:

- `npm install`, `npm run typecheck`, `npm run build` clean.
- Onchain pricing + TVL path against the live test node via `npm run check:chain`
  (11/11 prices sane, 10/10 pooled TVLs present; usdg is peg-priced, never pooled).
- Honest-motion audit: no `Math.random`/synthetic ticks anywhere in price paths.

Not verified during this build:

- Behavior across a chain-node outage window (backoff/reconnect paths are
  implemented; a sustained outage was not observed end to end).

## Wallet, dashboard, trade preview

The public site stays discovery-first. "Connect wallet" (secondary nav action) does a
real EIP-1193 connection to an injected wallet, then routes to `/dashboard` (fade
transition, connecting state, dashboard opens on completion). Disconnect actually
holds: it best-effort revokes the wallet-side `eth_accounts` permission
(`wallet_revokePermissions`, MetaMask-and-friends) and sets a local flag that
suppresses the silent `eth_accounts` restore on reload until the user explicitly
reconnects.

The dashboard shows connected identity, Robinhood Chain network status (labelled
*integration pending* — the wallet's actual network is shown separately, never
claimed as Robinhood Chain), Portofolio, the watchlist, and onchain activity fed by
the chain connection. `/trade/:id` is a swap page — RBNC ("RobinCrow", the chain's
native token) ⇄ asset with a live-quote calculator at a **1 RBNC = $1 placeholder
reference rate** — labelled *"Preview — execution pending"*; no transaction is ever
built or signed. `/agent` summarizes concentration and movers from live quotes
(deterministic, nothing fabricated), `/watchlist` and `/activity` round out the
logged-in surfaces. The journey — Discover → Understand → Connect → Access →
Track — is laid out in the homepage's "How Kovra works" section.

## Limitations

- Charts show the since-connection series with that label, or an honest
  placeholder; there is no historical candle feed.
- All instruments are `tradable: false` and shown with proxy labels; a pool price
  is never presented as an exchange quote.
- Onchain instruments are priced from Uniswap V3 pool swaps on a **test node** —
  indicative only. The 1 RBNC = $1 trade rate is a placeholder, not a market price.
- Volume/swap counters accumulate since server connection; TVL refreshes on real
  liquidity events (swap fee accrual is picked up on the next such event).
- No Robinhood/Robinhood Chain affiliation or verified asset integration.
