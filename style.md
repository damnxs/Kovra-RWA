# STYLE.md

## KOVRA-INSPIRED RWA / FINANCIAL INTELLIGENCE WEB STYLE

> Premium institutional RWA intelligence presented as an editorial publication.
> The interface should feel analytical, calm, precise, expensive, and intentional.
> Avoid generic SaaS and crypto visual conventions.

---

## 1. Design Philosophy

### Core principle

**Information should look like an editorial object.**

The website is not a conventional crypto dashboard. It should feel like a high-end financial research publication transformed into an interactive web experience.

Visual priority:

1. Editorial typography
2. Financial/data information
3. Geometry and grids
4. Controlled lime accent
5. Subtle interaction

The design should communicate:

- Institutional
- Intelligent
- Analytical
- Calm
- Precise
- Modern
- Onchain
- Premium
- Trustworthy

Avoid visual noise. Every element should have a purpose.

---

## 2. Visual Keywords

Use these keywords as the design north star:

- Institutional finance
- RWA
- Financial intelligence
- Swiss editorial
- Art direction
- Research publication
- Onchain infrastructure
- Market context
- Exposure
- Data visualization
- Minimal luxury
- Editorial grid
- Technical precision

Avoid:

- Generic SaaS
- Meme coin aesthetics
- Cyberpunk
- Excessive neon
- Glassmorphism
- Heavy gradients
- Rounded-everything
- Huge collections of cards
- Generic dashboard layouts
- Excessive shadows
- Futuristic sci-fi UI clichés

---

## 3. Color System

### Core palette

```text
Near Black       #1D1D1D
Deep Black       #101715
Warm Ivory       #F5F3EA
Soft Gray        #8B8B83
Charcoal        #242424
Pale Lime        #E9FFC4
Electric Lime   #C8FF3D
```

### Usage

**Warm Ivory**

Primary light background.

Use instead of pure white.

**Near Black**

Primary dark background and overall canvas for dark compositions.

**Electric Lime**

Use as a signal.

Good uses:

- Active data point
- Important metric
- Highlight block
- Selected grid cell
- Accent line
- CTA detail
- Key word
- Interactive state

Do not use lime as the dominant page color.

**Pale Lime**

Use for:

- Soft gradients
- Atmospheric backgrounds
- Large visual fields
- Hero illumination

### Color rule

> Lime should feel discovered, not sprayed everywhere.

---

## 4. Typography

Typography is one of the primary design elements.

### Display / Headlines

Use a high-contrast editorial serif.

Recommended direction:

- Canela
- Cormorant Garamond
- DM Serif Display
- Instrument Serif
- Playfair Display

Characteristics:

- High contrast
- Elegant
- Editorial
- Thin-to-medium weight
- Large scale
- Tight visual composition

Headlines may use uppercase.

Examples:

```text
READ THE
EXPOSURE
```

```text
MORE
CONTEXT
```

```text
CONNECT
THE MARKET
```

### Body / UI

Use a clean modern grotesk sans-serif.

Recommended:

- Inter
- Suisse Intl
- Neue Haas Grotesk
- Helvetica Neue
- IBM Plex Sans

Use for:

- Navigation
- Body copy
- Metadata
- Labels
- Metrics
- Buttons
- Technical information

### Typography hierarchy

The hierarchy should be intentionally extreme:

```text
LEVEL 01
Huge editorial headline

LEVEL 02
Small uppercase eyebrow

LEVEL 03
Supporting body copy

LEVEL 04
Tiny technical metadata
```

Small text should remain genuinely small.

---

## 5. Layout System

Use a strong editorial grid.

### Desktop

Prefer a 12-column grid.

```text
┌─────────────────────────────────────────────┐
│                                             │
│  01     02     03     04     05     06    │
│  07     08     09     10     11     12    │
│                                             │
└─────────────────────────────────────────────┘
```

Use:

- Large outer margins
- Consistent gutters
- Strong vertical alignment
- Thin rules
- Asymmetry
- Intentional empty space

Do not center every element.

### Recommended container

```css
max-width: 1440px;
margin-inline: auto;
padding-inline: 48px;
```

Scale responsively for smaller screens.

---

## 6. Whitespace

Whitespace is a core component.

Do not fill empty areas simply because space exists.

Large sections may contain only:

```text
SMALL LABEL


HUGE HEADLINE


                         DATA
```

Whitespace creates:

- Confidence
- Premium perception
- Editorial rhythm
- Visual hierarchy

The website should breathe.

---

## 7. Section Composition

A typical section should use this structure:

```text
SMALL EYEBROW

LARGE EDITORIAL HEADLINE

Short supporting statement

                    DATA / VISUAL
```

Prefer asymmetric layouts.

Example:

```text
┌─────────────────────────────────────────────┐
│ MARKET CONTEXT                              │
│                                             │
│ READ THE                                    │
│ EXPOSURE                    ┌────────────┐ │
│                             │ DATA       │ │
│                             │            │ │
│                             └────────────┘ │
└─────────────────────────────────────────────┘
```

---

## 8. Graphic Language

Graphics should represent financial information rather than decorative illustrations.

### Thin lines

Use 1px lines wherever possible.

```text
───────────────╮
               ╰────────────
```

Lines can represent:

- Market flows
- Relationships
- Exposure
- Data movement
- Connections

### Data grids

Use small square grids.

```text
□ □ □ □ □ □
□ □ □ □ □ □
□ □ □ ■ □ □
□ □ □ □ □ □
```

A single lime cell can indicate:

- Selected market
- Active asset
- Overlap
- Exposure
- Signal

### Network diagrams

```text
                 ○
               ╱
○─────────────●─────────────○
               ╲
                 ○
```

Use subtle lines and small nodes.

### Geometric blocks

Large rectangular lime blocks may sit behind typography.

Example:

```text
READ THE
EXPOSURE █████
```

They should feel editorial rather than UI-like.

---

## 9. Organic Forms

Hero and feature sections may use abstract flowing forms.

Visual direction:

```text
       ╭────────────────╮
  ╭────╯                ╰────╮
──╯                            ╰──
```

Forms should suggest:

- Liquidity
- Market flow
- Information
- Exposure
- Data layers

Use ivory, pale lime, and extremely soft gradients.

Never make them look like generic web blobs.

---

## 10. Gradients

Gradients should be atmospheric and subtle.

Preferred behavior:

```text
Warm Ivory
     ↓
Pale Lime
     ↓
Soft Lime
     ↓
Warm Ivory
```

Characteristics:

- Diffused
- Low contrast
- Smooth
- Organic
- Almost physical
- No glossy effects

Think:

**light passing through glass**

Not:

**neon cyberpunk gradient**

---

## 11. Dark Sections

Dark sections should feel more infrastructural and technical.

Palette:

```text
Background: #101715
Text:       #F5F3EA
Accent:     #C8FF3D
Lines:      muted green-gray
```

Example:

```text
CONNECT
THE MARKET

          ╭──────────────○
──────────┤
          ╰──────○
```

Use dark sections to communicate:

- Infrastructure
- Networks
- Market relationships
- Onchain systems
- Technical intelligence

---

## 12. Cards

Avoid conventional SaaS cards.

Prefer sharp editorial data blocks.

```text
┌──────────────────────────────┐
│ MARKET                       │
│                              │
│ RWA                          │
│                              │
│ $124.8M                      │
│                              │
│ ───────────────────────────  │
│ +4.82%                       │
└──────────────────────────────┘
```

### Card rules

- Minimal border
- Flat surface
- Very little or no shadow
- 0–4px border radius
- Strong typography
- Generous internal spacing

Cards should feel like information panels, not product tiles.

---

## 13. Buttons

Keep buttons minimal and editorial.

Prefer:

```text
ENTER PLATFORM →
```

or:

```text
EXPLORE MARKETS →
```

Instead of large rounded CTA buttons.

### Button characteristics

- Uppercase
- Small typography
- Strong letter spacing
- Minimal border
- Sharp corners
- Simple arrow
- No gradients
- No excessive hover effects

---

## 14. Navigation

Navigation should be quiet.

Example:

```text
KOVRA                    MARKETS   AGENT   RESEARCH   ENTER →
```

Characteristics:

- Small typography
- Wide spacing
- Minimal decoration
- No oversized navbar
- No large pill menus

The logo should have room to breathe.

---

## 15. Hero

Hero should feel like the cover of a financial publication.

Example:

```text
RWA AGENT

MARKET CONTEXT
ONCHAIN
```

Possible supporting line:

```text
ONE MARKET.
MORE CONTEXT.
```

Hero visual:

- Organic lime/ivory forms
- Fine grid
- Thin lines
- Subtle market data
- Large negative space

Do not overload the hero with UI.

---

## 16. Recommended Page Rhythm

A strong landing page can follow:

### 01 — HERO

```text
RWA
AGENT
```

Market context statement.

---

### 02 — EXPOSURE

```text
READ THE
EXPOSURE
```

Introduce market/asset intelligence.

---

### 03 — MARKET CONNECTION

Dark section.

```text
CONNECT
THE MARKET
```

Network visualization.

---

### 04 — CONTEXT

```text
MORE
CONTEXT
```

Explain how additional context changes market understanding.

---

### 05 — OVERLAP

```text
FIND THE
OVERLAP
```

Interactive grid / relationship visualization.

---

### 06 — EXPOSURE FLOW

```text
FOLLOW
THE EXPOSURE
```

Large flowing line / market trajectory.

---

### 07 — FINAL CTA

Minimal closing section.

```text
ONE MARKET.
MORE CONTEXT.

ENTER PLATFORM →
```

---

## 17. Motion

Motion should be slow, precise, and restrained.

### Good animation

- Lines drawing themselves
- Grid cells activating
- Nodes connecting
- Data points appearing
- Lime blocks sliding into position
- Typography revealing vertically
- Organic gradients slowly shifting
- Subtle scroll-linked exposure lines

### Timing

Prefer:

```text
200–400ms  UI interactions
500–900ms  Editorial reveals
1000ms+    Atmospheric motion
```

Use smooth easing.

Avoid:

- Bounce
- Elastic effects
- Glitch
- Fast flashing
- Aggressive parallax
- Excessive scroll animation

Motion should feel like **data moving**, not an entertainment website.

---

## 18. Responsive Design

### Desktop

Prioritize:

- Large typography
- Asymmetry
- 12-column grid
- Large visual compositions

### Tablet

Reduce:

- Typography scale
- Outer margins
- Grid complexity

Maintain editorial hierarchy.

### Mobile

Use a simplified editorial grid.

```text
EYEBROW

RWA
AGENT

Supporting copy

──────────────

DATA

──────────────

EXPOSURE
```

Do not simply shrink the desktop layout.

Recompose it.

---

## 19. Borders and Rules

Rules are important.

Use:

```css
border: 1px solid rgba(...);
```

But keep them visually subtle.

Prefer thin horizontal and vertical rules over shadows.

The grid itself should become part of the visual identity.

---

## 20. Border Radius

Default:

```text
0px
```

Acceptable:

```text
2px
4px
```

Avoid:

```text
12px
16px
24px
999px
```

The visual language is architectural and editorial, not soft SaaS.

---

## 21. Shadows

Use extremely little shadow.

Preferred:

```text
none
```

or extremely subtle elevation only when required for usability.

Depth should come from:

- Typography
- Contrast
- Borders
- Layering
- Gradient
- Whitespace

Not drop shadows.

---

## 22. Data Visualization

Data visualization should be understated.

Prefer:

- Thin line charts
- Sparse grids
- Single highlighted points
- Fine axes
- Minimal labels
- Lime signal points
- Editorial annotations

Avoid:

- Rainbow charts
- Thick chart lines
- 3D charts
- Excessive legends
- Dashboard clutter

---

## 23. Micro Typography

Microcopy should feel like financial research metadata.

Examples:

```text
MARKET CONTEXT
ONCHAIN

RWA / USD

UPDATED 08:42 UTC

MARKET 04

EXPOSURE INDEX

SOURCE: ONCHAIN
```

Use uppercase sparingly.

Tiny text should create technical depth without becoming visual noise.

---

## 24. Image / Illustration Direction

If imagery is used:

Prefer:

- Abstract macro photography
- Architectural surfaces
- Financial infrastructure
- Data textures
- Glass
- Paper
- Abstract liquidity
- Minimal technical diagrams

Avoid:

- Stock traders
- People pointing at charts
- Coins floating in space
- Generic blockchain imagery
- Rocket ships
- Cartoon apes
- Generic AI robots
- Futuristic city clichés

---

## 25. Component Philosophy

Every component should answer:

> Does this make the financial information easier to understand?

If not, remove it.

Prefer:

```text
Editorial section
+
Data
+
Visualization
+
One interaction
```

over:

```text
Hero
+
Cards
+
Badges
+
Pills
+
Gradients
+
Floating buttons
+
Decorative icons
```

---

## 26. Design Tokens

```css
:root {
  --color-bg-dark: #1D1D1D;
  --color-bg-deep: #101715;
  --color-bg-light: #F5F3EA;

  --color-text-dark: #1D1D1D;
  --color-text-light: #F5F3EA;
  --color-text-muted: #8B8B83;

  --color-accent: #C8FF3D;
  --color-accent-soft: #E9FFC4;
  --color-charcoal: #242424;

  --border-subtle: rgba(29, 29, 29, 0.16);
  --border-dark: rgba(245, 243, 234, 0.16);

  --radius-sm: 2px;
  --radius-md: 4px;

  --container-max: 1440px;
  --container-padding: 48px;

  --grid-columns: 12;
  --grid-gap: 24px;
}
```

---

## 27. CSS / Implementation Rules

### Do

- Use CSS Grid for primary layouts.
- Use 12-column desktop structures.
- Use fluid typography.
- Use `clamp()` for display type.
- Use 1px rules.
- Use CSS gradients sparingly.
- Keep components sharp.
- Preserve whitespace.
- Build responsive compositions rather than simply scaling.

### Don't

- Build everything with flexbox rows.
- Make every section centered.
- Use huge rounded containers.
- Add shadows to everything.
- Use gradients on every component.
- Overuse lime.
- Turn every element into a card.
- Add decorative UI without meaning.

---

## 28. Example Typography Scale

```css
.hero-title {
  font-size: clamp(4rem, 10vw, 10rem);
  line-height: 0.82;
  letter-spacing: -0.05em;
}

.section-title {
  font-size: clamp(3rem, 7vw, 7rem);
  line-height: 0.88;
  letter-spacing: -0.045em;
}

.eyebrow {
  font-size: 11px;
  line-height: 1.2;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.body {
  font-size: 16px;
  line-height: 1.5;
}

.micro {
  font-size: 9px;
  line-height: 1.3;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
```

Adjust based on the chosen font.

---

## 29. Quality Bar

The final website should look like it could belong to:

- An institutional RWA intelligence company
- A premium financial research firm
- An onchain market intelligence platform
- A modern European financial publication

It should **not** immediately look like:

- A crypto landing page
- A Web3 template
- A generic AI startup
- A SaaS dashboard
- A DeFi protocol template

The strongest visual signal is:

> **Editorial finance × onchain intelligence × restrained lime signal.**

---

## 30. Final Art Direction

When uncertain, choose:

**Less UI.  
More editorial composition.**

**Less decoration.  
More information.**

**Less color.  
More contrast.**

**Less animation.  
More precision.**

**Less crypto aesthetic.  
More institutional intelligence.**

The website should feel as if a world-class financial publication, an institutional asset manager, and an onchain intelligence platform collaborated on one visual system.
