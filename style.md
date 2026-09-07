# Kovra — Visual and Experience Guide

Read together with `technical.md`. This guide defines the public frontend. Build the actual responsive interface in code, not a static image of a website.

## Design intent

Kovra should feel like an elegant financial publication with useful live market discovery. The public homepage introduces an onchain RWA platform and immediately lets visitors inspect market data and categories. It must work before connecting a wallet.

The user prefers light surfaces, elegant minimalist serif headlines, restrained Robinhood-inspired lime, and abstract grids with soft gradients. Earlier 3D bar sculptures and a sidebar dashboard were rejected. Earlier lower-page designs felt too much like generic marketing. Make the lower page earn its space through useful content and working controls.

Public copy leads with RWA access and market context. Portfolio is an internal/product-detail term, not the hero identity. Avoid claims of available investment products or functioning agents where only a preview exists.

## Visual tokens

These are proposed Kovra design tokens, not an assertion of official Robinhood brand specifications.

```css
:root {
  --page: #fafbf7;
  --surface: #ffffff;
  --ink: #141713;
  --muted: #62685e;
  --line: #e2e6dc;
  --accent: #ccff00;
  --accent-soft: #f1fad5;
  --positive: #17763c;
  --negative: #b33d3d;
  --radius-control: 6px;
  --radius-panel: 8px;
  --content-max: 1280px;
}
```

Use lime for selected controls, small markers, and one primary CTA. Use dark text on lime. Use the darker positive color for small financial values on white. Maintain accessible contrast; do not rely on lime text or color alone to convey changes.

## Typography

Use an elegant high-contrast serif for display headlines, such as a properly licensed Instrument Serif or comparable available font. Pair it with Inter or a similarly clean sans serif for body, navigation, tables, and prices. Verify licenses and package availability; self-host if appropriate.

- Hero: roughly 64–84px desktop, 40–48px mobile; line height 1.02–1.08; maximum two or three intentional lines.
- Section titles: 32–44px desktop, 28–34px mobile.
- Body: 16px with about 1.5 line height.
- Data/UI: 13–16px; prices use tabular numerals to prevent shifting.
- Eyebrows: 11–12px with modest tracking; avoid decorative paragraphs of tiny uppercase text.

Do not make every heading enormous or set dense numerical data in an ornamental serif. Typography should establish clear hierarchy without overwhelming the markets.

## Homepage composition

### 1. Public navigation

Wordmark `kovra` on the left; Markets, Insights, and About as short working links. A compact action on the right leads to the implemented product surface. Use “Explore markets” if a separate app is not ready. No dead Launch App button. Use a modest navigation height around 72px.

### 2. Abstract hero

Use a full-width, airy composition with left-aligned editorial text and an abstract fine grid fading into off-white on the right. Add a soft lime gradient behind the grid, localized rather than washing out the whole page. Optional gently curved grid lines can add depth. Build this with CSS or SVG; no 3D object is required.

Suggested content:

> Know the market before you enter.
>
> Explore tokenized market exposure with clear data and intelligent context.

Primary action: Explore markets, scrolling to the market section. Secondary: How Kovra works, opening a real explanation. Do not overemphasize unimplemented agentic capabilities in the hero.

Keep the hero approximately 420–520px tall on a typical desktop, including breathing room but excluding navigation. The next market section should be visible near the first fold. No giant viewport-height empty hero.

### 3. Market pulse

A compact horizontal strip with four to six verified instruments. Each shows exact name/ticker, actual quote, correctly defined change, and status. Include source timestamp and data mode through visible text or accessible details. Call it “Market pulse” or “Market data”; display “Live” only for entitled real-time feeds.

Use narrow separators rather than inflated cards. Optional mini charts require actual data. On mobile, use a deliberate horizontal scroller or two-column layout.

### 4. Market discovery — the central feature

Provide a search field and horizontal category tabs: All, Broad Market, Technology, Energy, Financials, AI & Robotics, Healthcare. Show only categories with verified instruments; categories without coverage can be omitted rather than populated with fake data.

Separate categories from sorting controls such as Name and Today’s change. Do not mix time periods with categories. Use a selected lime accent and keyboard-accessible focus states.

Present a restrained market list or two-column panels with consistent alignment: instrument identity, type/proxy label, price/currency, session change, small real chart, and a detail link. Keep row heights comfortable. Prioritize the instrument's identity over decorative badges.

No fixed sidebar or right-hand trading panel on the homepage. A detail route or user-triggered drawer may show more information. Never use benchmark charts to imply that Kovra sells the benchmark itself.

### 5. Useful context below markets

Use a compact block for actual movers in the supported universe, watchlist items, or data-backed insights. Clearly identify the comparison universe. This replaces generic filler about transparency or the future of finance.

Kovra Agent can have one concise preview panel explaining exposure analysis, overlap, and alerts. Show an example only with a visible Example label. Display verified results when implemented. Never imply that an AI has analyzed a visitor's holdings before those holdings are available.

### 6. Product explanation and footer

Provide a short “How Kovra works” explanation connecting tokenized assets, curated exposure, and future vault mechanics. Keep planned capabilities explicitly identified. Finish with relevant links and source attribution; a large repeated closing sales banner is unnecessary.

## Interaction and data motion

- Animate only the value that actually changed: a subtle 400–700ms highlight, no flashing page.
- Keep digits aligned and avoid layout jumps.
- Respect reduced-motion preferences; stop decorative animation in background tabs.
- Never animate fake market movement. A moving gradient is decorative, not a price signal.
- Search, tabs, sorting, watchlist, chart periods, and detail links must work.
- Use semantic HTML, visible focus, accessible labels, and touch targets of at least 44px where practical.
- Do not announce every tick through screen-reader live regions; provide controlled status announcements instead.

## Responsive behavior

At desktop widths use a centered content area with 40–64px outer spacing and a clear grid. At tablet widths reduce gaps and market columns. At mobile widths use 20–24px margins, stacked hero text, subtle background art, scrollable category tabs, and compact market rows. Eliminate page-level horizontal overflow.

Use search and category controls before long lists so mobile visitors can find instruments quickly. Hide nonessential columns, not price identity or freshness. Avoid squeezing the desktop design into a scaled-down screenshot.

## Content and state rules

Use plain language: Market data, Holdings, Source, Updated, Delayed, Market closed, View details. Avoid vague claims such as “verified exposure,” “fully backed,” or “AI-powered returns” without evidence.

The empty state should say why data is unavailable and what the user can do. Missing credentials belong in developer setup messages; public users should see an appropriate service state without secret configuration details. Provider outages retain last known quotes with a visible stale indicator where useful.

Never copy illustrative prices, invented issuer facts, old copyright years, or decorative claims from earlier generated images. Those images indicate composition only. The implemented UI must use the registry and real data described in `technical.md`.

## Visual acceptance

Review the homepage at approximately 1440px, 1024px, and 390px widths. Confirm the hero feels elegant, market data appears early, categories are obvious, data stays readable while updating, and the lower page contains useful functionality. Confirm accessibility, loading states, closed-market behavior, and actual data-source labels. Deliver screenshots for review along with the implemented code; do not use screenshots as a substitute for functioning UI.
