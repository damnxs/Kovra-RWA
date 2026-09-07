import { Chip } from './Chip';
import { Reveal } from './Reveal';

/** One step of the user journey. `live` is tri-state: true / false / null (no chip). */
type Step = { title: string; live: boolean | null; body: string };

const STEPS: Step[] = [
  {
    title: 'Discover',
    live: true,
    body: 'Browse a verified universe of market references — broad market, technology, energy, financials, healthcare — with search, categories, and live prices.',
  },
  {
    title: 'Understand',
    live: true,
    body: 'Every instrument states what its price represents: proxy labels, provider, source timestamps, freshness. Kovra Agent turns the same data into plain-language context.',
  },
  {
    title: 'Connect',
    live: true,
    body: 'Connect an EVM wallet to open your Kovra dashboard. Connection is identity only today — Kovra holds no keys, signs nothing, and never asks for approvals.',
  },
  {
    title: 'Access',
    live: false,
    body: 'Tokenized exposure on Robinhood Chain: verified token contracts, liquidity, and transaction routes. Nothing becomes purchasable until each is verified and disclosed.',
  },
  {
    title: 'Track',
    live: false,
    body: 'Holdings, watchlists, and onchain activity in one surface — with the same sourcing discipline as the market data.',
  },
  {
    title: 'Where we are today',
    live: null,
    body: 'Discover, Understand, and Connect are live on this site. Access and Track arrive with verified contracts — until then, every surface says so.',
  },
];

/** The user journey: Discover → Understand → Connect → Access → Track. */
export function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-heading" className="scroll-mt-24">
      <p className="eyebrow">How Kovra works</p>
      <h2 id="how-heading" className="mt-3 font-serif text-[32px] leading-tight sm:text-4xl">
        From discovery to onchain access.
      </h2>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <Reveal key={s.title} delay={(i % 3) * 100}>
            <div className="h-full rounded-panel border border-line bg-surface p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted">0{i + 1}</p>
                {s.live === true && <Chip tone="positive">Live now</Chip>}
                {s.live === false && <Chip>Coming soon</Chip>}
              </div>
              <h3 className="mt-2 font-medium">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
      <Reveal>
        <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted">
          Kovra intends to deploy on Robinhood Chain. No official partnership, verified asset
          integration, or live investment product exists today, and ETF references do not imply Kovra
          sells or tracks those funds as products.
        </p>
      </Reveal>
    </section>
  );
}
