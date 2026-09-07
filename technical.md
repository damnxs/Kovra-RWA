# Kovra — Technical Build Guide for Claude Code

Read this file and `style.md` before implementing. Treat both as the project brief. Follow repository instructions and preserve existing user work. Build the public homepage first, with working market discovery and authentic price updates. Do not begin with a sidebar trading terminal.

## Product purpose

Kovra is being developed as an onchain RWA platform for exploring and accessing tokenized financial exposure, with an agentic AI layer for monitoring and analysis. Robinhood Chain is the intended deployment network. No official partnership, verified asset integration, or live investment product is established by this brief.

Public messaging should lead with RWA access, market data, and understandable exposure. Avoid leading with “portfolio platform.” Internally, a Portfolio remains a curated allocation of supported asset tokens; a Vault is the contract that would hold those assets and account for user units. An Index is a methodology or benchmark that a portfolio may follow. These concepts are not interchangeable.

The planned investment mechanism is a portfolio vault: users contribute supported assets, receive proportional vault units, monitor holdings, and redeem under disclosed rules. This is a later integration milestone, not permission to implement real-money contracts from this brief alone. The first deliverable is an informative, working public frontend and data service. Do not present benchmarks as purchasable tokens or activate unfunded buy flows.

## Required first release

- Public `/` homepage combining a restrained brand hero, market pulse, real quotes, category tabs, and market discovery.
- `/markets` with search, categories, sorting, and accessible market rows or panels.
- `/markets/[id]` with instrument identity, currency, source, latest price, timestamps, supported history, session status, and relevant underlying-exposure information.
- Local watchlist that works without a wallet; label it as watched instruments rather than owned exposure.
- Kovra Agent preview explaining useful analysis; functional deterministic insights where data supports them.
- Useful loading, empty, missing-key, delayed, disconnected, rate-limited, and closed-market states.

Use existing repository technology. For a new repository, a reasonable baseline is Next.js, TypeScript, Tailwind, and a maintained chart library. Check installed versions and official documentation before choosing APIs. Keep the project portable; do not introduce paid infrastructure automatically.

## Free data requirement — hard constraint

Market-price acquisition must use a genuinely free plan or source. Never subscribe, start a paid trial, enable metered billing, or silently switch to a paid endpoint. Free does not necessarily mean keyless, unrestricted, or licensed for external display.

Do not promise that every stock index can be streamed free on a public commercial website. Before enabling a provider, verify all four conditions: supported instruments, actual delay, account quota, and permission for this use. A technically reachable endpoint is not sufficient evidence of redistribution rights.

### Provider selection

| Candidate | Intended evaluation | Constraint |
| --- | --- | --- |
| Finnhub | First candidate for a small development universe of US equity/ETF quotes and trade streaming | Verify free-account entitlements, symbol limits, and public/commercial display rights; do not assume the complete stock-index universe is included |
| Twelve Data | Alternative adapter if the selected free entitlement covers the instruments and intended use | Individual access must not be assumed to permit public business display; verify WebSocket and history access separately |
| Alpha Vantage | Occasional supported snapshots or metadata | Its ordinary free allowance is unsuitable for continuous multi-symbol updates; not the default streaming source |
| Verified onchain pools/RPC | Future prices for actual supported asset tokens | Requires verified contracts, adequate liquidity, rate-limit planning, and accurate token/quote-asset identification; not a substitute for official equity/index prices |

Do not scrape Yahoo Finance, Google Finance, TradingView pages, or private endpoints as an undocumented workaround. Do not rotate keys or IP addresses to evade quotas. A hosted chart widget, if its terms permit use, is an embed—not an API source for other components.

If no free provider permits the required public use, finish the adapter and interface with clearly marked unavailable states, and report the exact unresolved entitlement. A development-only feed can remain enabled locally with explicit configuration. Never mark the public integration complete in that situation.

### Instruments and proxies

Start with a small verified universe. Candidate ETF references include SPY (broad US equity proxy), QQQ (Nasdaq-100 ETF proxy), XLE (energy ETF), XLF (financial ETF), and XLV (healthcare ETF). These are candidates, not assertions of provider availability or Kovra tradability.

An ETF price is not an index level. If displaying QQQ, show “QQQ · Nasdaq-100 ETF proxy,” its own actual price, and the correct exchange/currency metadata. Never place QQQ's price under “US Tech 100” as though it were NDX. Likewise, a token linked to an ETF can have a different executable price from the ETF itself.

Maintain a registry with stable IDs, provider symbols, display names, instrument type, category, currency, venue, benchmark/proxy relationship, and tradability status. Do not invent constituent counts, volume, market cap, holdings, or token addresses.

## Real-time architecture

Use one shared upstream subscription per provider/service instance and fan out normalized updates to clients through SSE or WebSocket. Keep provider keys server-side. Use a persistent worker when the hosting platform cannot sustain upstream connections; do not assume a serverless route supports indefinite connections or shared process memory.

Bootstrap with an entitled snapshot, subscribe only to supported instruments, validate events, update a cache, then broadcast changed quotes. Deduplicate symbols across viewers. Use connection limits, bounded buffers, cleanup, exponential reconnect backoff with jitter, and heartbeat monitoring. On reconnect, reconcile with a fresh snapshot where the plan allows it.

If streaming is unavailable but polling is permitted, choose a budgeted interval and label the result “Auto-refresh” with the actual delay, rather than implying tick-by-tick delivery. Estimate the request budget before implementing:

```text
requests/minute = symbols × 60 / polling_interval_seconds
```

Adjust for actual batching and provider credit weights. For example, five symbols polled individually every 15 seconds require 20 requests/minute before retries and history requests. Never poll separately for every visitor.

### Normalized quote contract

```ts
type Quote = {
  instrumentId: string;
  price: string; // decimal representation
  currency: string;
  provider: string;
  sourceTimestamp: string; // event time, UTC ISO8601
  receivedAt: string;      // receipt time, not a replacement for event time
  mode: 'realtime' | 'delayed' | 'snapshot';
  delaySeconds: number | null;
  session: 'open' | 'closed' | 'pre' | 'post' | 'unknown';
  previousClose: string | null;
  changePct: number | null;
};
```

Track connection health and stale status separately from session and quote mode. An open socket does not prove a recent price; an unchanged last trade can be valid for an illiquid instrument. Determine status from provider/session semantics, quote timestamps, and heartbeat information. Handle holidays and daylight saving through reliable exchange-calendar data, not a weekday-only rule.

Use decimal-safe calculations for accounting. Format currency, decimal places, and percentage values consistently. Equity “Today” change means change against the appropriate previous session close. A rolling “24h” metric is different and must be labeled separately. Hide unavailable percentages rather than calculating them from an unrelated baseline.

### Honest motion

Prices and chart points change only when real source events arrive. Brief green/red highlights may reflect actual movement. Never use random walks, periodic fabricated ticks, or animated historical points to imply live data. During market closure, display the last available price and session status.

Historical sparklines require real timestamped observations. If historical access is not free, show the available since-connection series with that label, or a placeholder. Do not invent a full day of history. Demo fixtures may exist only in an explicit isolated Demo mode with a persistent visible label; never silently mix them with live quotes.

## Data and API organization

Separate provider adapters, instrument registry, normalization, cache/broadcast service, history retrieval, and presentation components. Suggested internal endpoints are `/api/markets`, `/api/quotes`, `/api/stream`, and `/api/history`. These are application endpoints, not claimed provider routes. Implement provider requests from current official documentation.

Recommended configuration:

```dotenv
MARKET_DATA_PROVIDER=finnhub
FINNHUB_API_KEY=
MARKET_DATA_MODE=development
PUBLIC_DISPLAY_APPROVED=false
DEMO_MODE=false
```

The approval flag is an operational gate, not proof of licensing: record the actual entitlement assessment before enabling it. Ship `.env.example`, never secrets. Keep public client configuration free of private keys. In multiple service instances, use coordinated subscriptions/shared state or document the limitation and enforce quotas conservatively.

## Agentic AI scope

Kovra Agent should progressively monitor approved sources, identify relevant changes, and produce source-linked explanations or proposed actions. Its initial useful jobs are concentration analysis, overlap detection, and watchlist alerts. Calculate numerical exposure deterministically before any language-model explanation.

Do not describe watchlist overlap as the user's owned financial exposure. Distinguish actual connected positions from hypothetical allocations and watched instruments. Do not invent holdings, market news, signals, or AI confidence scores.

A static insight card or ordinary summarizer is not a complete autonomous agent. If no agent runtime is integrated, label the feature “Preview.” Do not add a paid model API by default; a deterministic analysis module can work without one. Any future transaction proposal requires explicit user approval and bounded execution permissions. AI text cannot determine vault accounting or become a settlement oracle.

## Future vault integration

Before investment actions are enabled, verify token transfer compatibility, issuer rights, liquidity, oracle freshness, corporate-action handling, fees, and redemption behavior. Underlying tokens do not automatically confer direct shareholder rights.

Conceptual accounting: NAV equals validated holdings value plus cash minus liabilities; NAV per unit equals NAV divided by outstanding units. Initial issuance, rounding, pending settlement, cost allocation, and failures need a full specification. Treat investment contracts and security review as a separate implementation milestone.

Do not hardcode unverified Robinhood Chain parameters or advertise a token as integrated because its ticker exists. Use official chain and asset documentation at implementation time. Market display feeds must not silently become trusted vault valuation feeds.

## Implementation order and acceptance

1. Inspect the repository and read `style.md`; implement the public homepage structure.
2. Assess one free provider and record entitlement, covered instruments, quotas, and delay in project notes.
3. Implement its adapter, server-side streaming or budgeted polling, and honest status handling.
4. Wire homepage quotes, categories, search, market details, and local watchlist to the same registry and data state.
5. Add deterministic insights and clear Agent Preview states.
6. Verify at desktop and mobile sizes; hand off setup instructions and remaining integration constraints.

Acceptance requires working category/search controls, no exposed provider secrets, source/timestamp visibility, no synthetic live ticks, correct proxy labels, graceful failures, and no surprise paid dependencies. Test normalization, previous-close calculations, out-of-order events, reconnection, quota responses, stale data, closed sessions, and missing credentials. During an open supported session, observe a real incoming event reaching the browser. If live validation is impossible, state exactly what was and was not verified; never manufacture a tick to pass the check.

## Official starting references

Reviewed as planning references on 2026-09-07; recheck account-specific entitlements before integration.

- [Finnhub API documentation](https://finnhub.io/docs/api)
- [Finnhub streaming documentation](https://finnhub.io/docs/api/websocket-trades)
- [Finnhub pricing](https://finnhub.io/pricing-stock-api-market-data)
- [Twelve Data individual pricing](https://twelvedata.com/pricing)
- [Twelve Data business pricing](https://twelvedata.com/pricing-business)
- [Alpha Vantage free request allowance](https://www.alphavantage.co/support/)
- [Robinhood Chain documentation](https://docs.robinhood.com/chain/)

The provider list is an evaluation path, not confirmation that a free public commercial feed has already been secured.
