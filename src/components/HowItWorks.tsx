import { Chip } from './Chip';
import { Reveal } from './Reveal';

/** One step of the user journey. `live` is tri-state: true / false / null (no chip). */
type Step = { title: string; live: boolean | null; body: string };

const STEPS: Step[] = [
  {
    title: 'Discover',
    live: true,
    body: 'The full tape: tokenized stocks, private assets, crypto and stablecoins, searchable and sortable, each priced live from the pool where it trades.',
  },
  {
    title: 'Understand',
    live: true,
    body: 'Every price shows its provenance: the pool it came from, when it was struck, how fresh it is. Kovra Agent turns the same raw data into plain-language context.',
  },
  {
    title: 'Connect',
    live: true,
    body: 'Connect an EVM wallet to open your dashboard. Connection proves identity only: Kovra never controls your wallet, never sends transactions, never asks for spending approval.',
  },
  {
    title: 'Access',
    live: false,
    body: 'Buy and sell tokenized assets on Robinhood Chain, once token contracts, pools and routes are verified. Nothing becomes purchasable until each is verified and disclosed.',
  },
  {
    title: 'Track',
    live: false,
    body: 'Holdings, watchlists and onchain activity on one surface, held to the same sourcing discipline as every price on the site.',
  },
  {
    title: 'Where we are today',
    live: null,
    body: 'Discover, Understand and Connect are live today. Access and Track arrive with verified contracts, and until then every surface says so.',
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
          Kovra plans to build on Robinhood Chain. There is no partnership with Robinhood today and
          no investment product for sale; showing a token here is not an endorsement or an offer.
        </p>
      </Reveal>
    </section>
  );
}
