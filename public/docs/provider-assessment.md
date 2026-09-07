# Market Data Provider Assessment — Finnhub (free tier)

Assessment date: 2026-09-07. Assessor: Kovra build record. This is an entitlement
review required by `technical.md` before any public display approval. Re-verify
account-specific entitlements before relying on any row below.

## Verdict

**Suitable for development use; NOT approved for public commercial display.**
`PUBLIC_DISPLAY_APPROVED` therefore stays `false` in `.env.example`. Redistribution
and commercial public-display rights on the free tier are unresolved (no explicit
grant found in the reviewed sources), so the integration is finished but gated.

## Findings

| Question | Finding | Status |
| --- | --- | --- |
| Supported instruments | SPY, QQQ, XLE, XLF, XLV — all US-listed ETFs, covered by US stock endpoints | Verified (free tier covers US symbols) |
| Actual delay | WS trade frames are real-time for entitled symbols; REST `/quote` is a snapshot. Any per-account delay entitlement not verifiable without a live key session | Partially verified |
| Account quota | ~60 API calls/min, ~30/sec burst cap; WS trades included on free for US stocks, ≤50 symbols per connection | Verified against published docs/pricing |
| History | `/stock/candle` is premium-only → app never calls it; charts use since-connection series only | Verified (premium wall) |
| Redistribution / public commercial display rights | No explicit free-tier grant found; paid/business licensing exists separately | **Unresolved** |

## Request budget actually used by this app

- Bootstrap: 5 × REST `/quote` once per server start (and once per reconnect gap > 60s).
- Steady state: 1 WS connection subscribing 5 symbols (no per-request cost).
- Poll fallback (WS fails 3×): 5 symbols / 15s = 20 requests/min, one server-global
  loop, never per browser. Well under the 60/min cap.
- On HTTP 429: pause upstream requests ≥ 60s (honors `Retry-After`), keep serving
  cache, broadcast rate-limited status. No retry storms.

## Sources reviewed (2026-09-07)

- Finnhub API documentation — https://finnhub.io/docs/api
- Finnhub WebSocket trades — https://finnhub.io/docs/api/websocket-trades
- Finnhub pricing — https://finnhub.io/pricing-stock-api-market-data

## What was verified live vs. not

Verified without a key: endpoints, quotas, and premium boundaries as documented.
Verified with a development key during the build: REST `/quote` responses for the
five symbols and WS `trade`/`ping` frame shapes.
Not verified: a live tick observed in the browser during an open session (initial
build day was Labor Day, NYSE closed — see README limitations), and any commercial
redistribution entitlement.
