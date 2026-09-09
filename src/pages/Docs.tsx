import { useEffect, useState } from 'react';
import { LuArrowUpDown } from 'react-icons/lu';
import { HowItWorks } from '../components/HowItWorks';
import { Reveal } from '../components/Reveal';

/**
 * User documentation, what Kovra is and how to use every surface of it.
 * Sticky contents sidebar with scrollspy on desktop, pill strip on mobile,
 * numbered sections that reveal on scroll.
 */

const SECTIONS = [
  { id: 'what', label: 'What is Kovra' },
  { id: 'markets', label: 'Markets & prices' },
  { id: 'watchlist', label: 'Watchlist' },
  { id: 'wallet', label: 'Connect wallet' },
  { id: 'portofolio', label: 'Portfolio' },
  { id: 'trade', label: 'Trade' },
  { id: 'agent', label: 'Agent' },
  { id: 'activity', label: 'Activity' },
  { id: 'limits', label: 'Limits & honesty' },
  { id: 'how-it-works', label: 'Product journey' },
];

function Section({
  n,
  id,
  title,
  children,
}: {
  n: number;
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Reveal>
      <section id={id} className="scroll-mt-28 border-t border-line pt-8">
        <p className="eyebrow">
          Section {String(n).padStart(2, '0')}
        </p>
        <h2 className="mt-2 font-serif text-[26px] leading-tight sm:text-3xl">{title}</h2>
        <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-muted">{children}</div>
      </section>
    </Reveal>
  );
}

export function Docs() {
  const [active, setActive] = useState(SECTIONS[0]!.id);

  // Scrollspy: highlight the section occupying the upper viewport band.
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: '-10% 0px -75% 0px' },
    );
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, []);

  return (
    <div className="fade-in mx-auto max-w-content px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
      <p className="eyebrow">Guide</p>
      <h1 className="mt-3 max-w-2xl font-serif text-[36px] leading-tight sm:text-[44px]">
        What Kovra is, and how to use it.
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
        Every surface of Kovra, explained: what each page shows, what it needs from you, and what
        it cannot do yet.
      </p>

      {/* Mobile: contents as a horizontal pill strip. */}
      <nav
        aria-label="Guide sections"
        className="tab-scroll -mx-5 mt-8 flex gap-2 overflow-x-auto px-5 pb-1 lg:hidden"
      >
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className={`shrink-0 rounded-control border px-3.5 py-2 text-sm transition-colors ${
              active === s.id
                ? 'border-transparent bg-accent text-ink'
                : 'border-line bg-surface text-muted hover:border-ink hover:text-ink'
            }`}
          >
            {s.label}
          </a>
        ))}
      </nav>

      <div className="mt-8 grid gap-10 lg:mt-12 lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-16">
        {/* Desktop: sticky contents sidebar with scrollspy. */}
        <aside className="hidden lg:block">
          <nav aria-label="Guide sections" className="sticky top-28">
            <p className="eyebrow">Contents</p>
            <ul className="mt-3 space-y-0.5 border-l border-line">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    aria-current={active === s.id ? 'true' : undefined}
                    className={`-ml-px block border-l-2 py-1.5 pl-4 text-sm transition-colors ${
                      active === s.id
                        ? 'border-ink font-medium text-ink'
                        : 'border-transparent text-muted hover:border-ink/40 hover:text-ink'
                    }`}
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <div className="max-w-3xl space-y-12">
          <Section n={1} id="what" title="What is Kovra">
            <p>
              Kovra is a research terminal for tokens that track real-world assets: stocks, energy,
              private companies and more, all trading on Robinhood Chain. Browse every tracked
              market, see live prices, understand what each number means, and once you connect a
              wallet, see your own portfolio. It is not an investment product, and nothing on it
              is investment advice.
            </p>
            <p>
              The long-term goal is buying and selling these assets on Robinhood Chain, once token
              contracts, pools and routes are verified. None of that is live yet, and every
              surface says so rather than pretending otherwise.
            </p>
          </Section>

          <Section n={2} id="markets" title="Markets & prices">
            <p>
              Open <strong className="font-medium text-ink">Markets</strong> to see every tracked
              instrument with its current price, today&rsquo;s change versus the previous close, and
              a sparkline of movement since you connected. Search by symbol or name, filter by
              category, and sort by name or performance. Each row&rsquo;s{' '}
              <strong className="font-medium text-ink">Trade</strong> button opens the trade
              calculator for that instrument; the arrow opens its full detail page with its
              description, chart and price source.
            </p>
          </Section>

          <Section n={3} id="watchlist" title="Watchlist">
            <p>
              The watchlist is your saved set of instruments, stored locally in this browser, no
              wallet needed. Watch or unwatch from an instrument&rsquo;s detail page, then open{' '}
              <strong className="font-medium text-ink">Watchlist</strong> to review only what you
              saved, with the same search, category, and sort controls as Markets.
            </p>
            <p>
              Watching is reading interest, never ownership. The watchlist is also the state a
              future wallet sync would start from.
            </p>
          </Section>

          <Section n={4} id="wallet" title="Connect wallet">
            <p>
              Kovra works without a wallet, but connecting unlocks the Portfolio, Trade, and
              Activity surfaces. Click{' '}
              <strong className="font-medium text-ink">Connect wallet</strong> (top right) and
              approve the request in your wallet (MetaMask or any browser wallet works).
            </p>
            <p>
              Connection is identity only. Kovra holds no keys, signs nothing, and never asks for
              approvals. Your wallet&rsquo;s actual network is shown, not a generic
              &ldquo;connected&rdquo; badge, because Robinhood Chain integration is still pending.
            </p>
          </Section>

          <Section n={5} id="portofolio" title="Portfolio">
            <p>
              After connecting, <strong className="font-medium text-ink">Portfolio</strong> is your
              account overview: verified balances with totals, change, allocation and portfolio
              mix. Until
              then it shows an honest empty state instead of a fabricated $0 portfolio.
            </p>
          </Section>

          <Section n={6} id="trade" title="Trade">
            <p>
              The Trade page is an exchange calculator between{' '}
              <strong className="font-medium text-ink">RobinCrow (RBNC)</strong>, the native
              currency of Robinhood Chain, and the market you picked. Enter an amount on the pay
              side and the estimated receive side updates from the current price, with the exchange
              rate and order value. Use{' '}
              <strong className="font-medium text-ink">
                <LuArrowUpDown aria-hidden="true" className="h-3 w-3" /> Switch
              </strong>{' '}
              to flip direction between
              buying and selling.
            </p>
            <p>
              A wallet must be connected first. Orders are recorded as{' '}
              <strong className="font-medium text-ink">previews</strong>: no contracts, liquidity,
              or routes are verified yet, so nothing is signed, sent, or settled. Until RBNC has a
              real market price, the calculator assumes $1 per RBNC.
            </p>
          </Section>

          <Section n={7} id="agent" title="Agent">
            <p>
              <strong className="font-medium text-ink">Agent</strong> turns verified data into
              plain-language context. Today it computes the largest tracked market move of the day
              (live); the landing page shows a clearly labeled scripted chat illustration. It states
              plainly what it cannot compute yet, such as how concentrated your holdings are and
              where they overlap, until verified balances exist. It never presents watchlist data
              as owned exposure.
            </p>
          </Section>

          <Section n={8} id="activity" title="Activity">
            <p>
              <strong className="font-medium text-ink">Activity</strong> is the chain&rsquo;s pulse
              in realtime: every trade, liquidity event and block on Robinhood Chain, streamed the
              moment it confirms, each line linked to its transaction on the explorer. Only real
              events are ever shown; nothing here is sample activity.
            </p>
          </Section>

          <Section n={9} id="limits" title="Limits & honesty">
            <ul className="space-y-3">
              {[
                'Kovra has no affiliation with Robinhood, Robinhood Chain, or any token issuer.',
                'Markets shown are tokens trading in public pools on Robinhood Chain, not products Kovra sells.',
                'Prices move only on real chain events; nothing is simulated.',
                'Charts show only the series since your connection; longer history is not available yet.',
                'No buying, selling, or transferring is possible through Kovra today.',
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-line" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </Section>

          <HowItWorks />
        </div>
      </div>
    </div>
  );
}
