# Kovra Dashboard — Product and Design Guide

Read `technical.md` and `style.md` first. This file defines the connected-user dashboard. It should extend the public Kovra experience after a wallet connection, not replace the public homepage.

## Purpose

The dashboard helps a crypto-native user understand their onchain RWA market exposure after connecting a wallet. It answers four questions quickly:

1. What exposure am I tracking or holding?
2. How has it changed?
3. Where is my concentration or overlap?
4. What market context matters next?

The intended journey is:

```text
Discover markets → Understand exposure → Connect wallet → Track positions → Explore the next market
```

Do not claim that a user owns or can trade an asset unless a verified wallet balance and supported transaction route exist. Before these integrations are available, use a clearly labelled watchlist and empty-state dashboard.

## Routes and states

| Route | Purpose |
| --- | --- |
| `/` | Public homepage and market discovery |
| `/markets` | Searchable market universe and categories |
| `/markets/[id]` | Instrument data, source, history, and available exposure information |
| `/dashboard` | Connected user’s My Exposure overview |
| `/watchlist` | Saved instruments, accessible with or without a wallet |
| `/activity` | Connected onchain activity when an indexer is available |

Dashboard states must be designed deliberately:

- **Disconnected:** explain that connecting a wallet enables tracked balances and activity. Include a visible Connect Wallet CTA.
- **Connected, no supported holdings:** show wallet/network status, an empty My Exposure state, watched markets, and Explore Markets CTA.
- **Connected, supported holdings:** show only verified balances and exposure derived from supported assets.
- **Data unavailable:** retain last known values when appropriate, show the source timestamp and stale state.

## Navigation

Use one compact top navigation shared with the public site:

- `kovra` wordmark at left.
- `Markets`, `My Exposure`, and `Activity` as primary links.
- On the right: network indicator, abbreviated wallet address after connection, account menu, and `Explore markets` action.
- Before connection: show `Connect wallet` in the same location.

The network indicator may read `Robinhood Chain` only after the connected wallet is confirmed on the intended network. If the wallet is on another network, provide a clear switch-network state. Do not hardcode a “connected” indicator.

## Desktop dashboard composition

Use a centered content canvas with a maximum width around 1280px. The dashboard should feel calm, editorial, and data-aware. It must not use a persistent left sidebar or dense trading-terminal layout.

### Header and account summary

Start with an eyebrow, `CONNECTED ACCOUNT`, and the display-serif title `My exposure.` On the right, show the truthful refresh label, such as `Auto-updated every minute` with a small status dot.

Place three horizontal summary metrics beneath a hairline divider:

| Metric | Meaning |
| --- | --- |
| Total exposure | Only the value of supported, verified tracked holdings |
| Period change | Use a precisely labelled period such as Today or 24h; do not mix them |
| Assets tracked | Count supported positions, excluding ordinary watchlist items |

If no supported wallet holdings exist, do not display zero as a fabricated portfolio. Replace the summary with a short empty state and Explore Markets action.

### Main exposure section

Use a 65/35 two-column layout on desktop, stacking on smaller screens.

Left side: `Your market exposure` plus a compact table. Fields may include asset/exposure name, category, allocation, value, period change, trend, and detail link. Use fixed column alignment, tabular numerals, thin horizontal dividers, and short trend lines built from real history only.

Right side: `Exposure mix` with a restrained donut chart and exact category legend. The chart must be generated from the same values as the table. Keep lime for selected or primary emphasis; use neutral grays and near-black for remaining segments.

Under the chart, show Kovra Agent. It should read as an analytical context layer, not a chat box or autonomous trader. Example insights must be visibly labelled `Example insight` until data-backed. Valid initial insights include concentration, overlap, and largest tracked movement. Use an outlined `Review exposure` action.

### Watchlist and market context

Below the exposure area, place `Market watchlist` with category tabs: All, Technology, Energy, Financials, AI & Robotics, Healthcare. The watchlist remains useful even when no wallet is connected.

Each row or compact panel shows instrument name, accurate type/proxy label, latest price, properly labelled change, a small chart based on actual history, source time, and a detail link. Provide `Manage watchlist` as a working action.

Show `Auto-updated every minute` or `Updated 34s ago`, never `Live`, for the configured 60-second refresh model. Do not present ETFs or benchmarks as purchasable Kovra assets.

### Activity

The Activity route should begin with a clean chronological list: time, event type, asset, amount/value when verifiable, transaction link, and status. Examples include wallet connected, asset detected, watchlist saved, or verified onchain transfer.

Do not fabricate transactions. When no indexer or supported transaction source exists, render a thoughtful empty state rather than sample activity presented as real.

## Visual system

Inherit these tokens from `style.md`:

```css
--page: #fafbf7;
--surface: #ffffff;
--ink: #141713;
--muted: #62685e;
--line: #e2e6dc;
--accent: #ccff00;
--accent-soft: #f1fad5;
--positive: #17763c;
--negative: #b33d3d;
```

Use the display serif for `My exposure.`, section titles, and large totals. Use the sans-serif for all navigation, labels, tables, controls, timestamps, and chart axes. Monetary values should use tabular numerals. Limit rounded controls to roughly 6px; panels should rely on whitespace and hairline dividers rather than shadows or heavy cards.

The page background remains warm off-white. Keep the lime accent concentrated in active category controls, small agent markers, primary actions, and one highlighted chart segment. Green and red values must always include sign and text/shape context; color alone is insufficient.

## Motion and refresh

The configured market-data interval is 60 seconds. Make that visible and honest.

- While refreshing, a small dot may pulse and the label may read `Updating…`.
- When a verified price changes, animate only the changed digits and flash the affected value briefly: lime/green for up, muted red for down.
- Timestamp text may fade in after a successful update.
- Do not animate charts, numbers, or trends without a new source event.
- Respect `prefers-reduced-motion` by removing nonessential transitions.
- Avoid layout shifts as values update.

## Responsive behavior

At tablet and mobile widths, stack the summary metrics, then stack the exposure table and mix chart. Preserve identity, value, change, and detail controls while hiding lower-priority columns. Use a horizontal scroll area for category tabs if necessary. Keep outer margins at about 20–24px on mobile and prevent page-level horizontal overflow.

Do not shrink the desktop table until it becomes unreadable. Convert it to stacked exposure rows with labelled values on mobile.

## Acceptance checklist

- Wallet state is accurate, including wrong-network and disconnected states.
- Dashboard never shows unverified assets as holdings.
- Table, chart, summary, and Agent insight derive from the same data model.
- Watchlist is functional without wallet connection.
- Values, timestamps, source state, closed market state, and stale state are visible.
- Refresh occurs once per minute without duplicate client requests.
- Layout is reviewed at desktop, tablet, and mobile widths.
- No persistent sidebar, fake transactions, fake holdings, or fabricated market motion.
