import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LuArrowRight } from 'react-icons/lu';
import { useMarket } from '../data/MarketProvider';
import { HeroScene } from './HeroScene';
import { PriceCell } from './PriceCell';
import { ChangeLabel } from './ChangeLabel';
import { formatPrice } from '../lib/format';

/**
 * Full-page hero: the live pool-price chart IS the background, and the copy is
 * also its control surface, symbol chips switch what the background draws and
 * the readout follows it in realtime.
 */
export function Hero() {
  const { instruments, quotes, points } = useMarket();
  const [selected, setSelected] = useState('');

  // Default to the instrument with the most live action so far.
  const ranked = useMemo(
    () =>
      [...instruments].sort(
        (a, b) => (points[b.id]?.length ?? 0) - (points[a.id]?.length ?? 0),
      ),
    [instruments, points],
  );
  const active = instruments.find((i) => i.id === selected) ?? ranked[0];
  const q = active ? quotes[active.id] : undefined;

  return (
    <section
      className="relative min-h-[calc(100svh-150px)] overflow-hidden border-b border-line sm:min-h-[calc(100svh-72px)]"
      aria-labelledby="hero-heading"
    >
      {active && (
        <div className="absolute inset-0" aria-hidden="true">
          <HeroScene series={points[active.id] ?? []} className="h-full w-full" />
        </div>
      )}
      {/* Legibility washes: copy sits on the left, the chart breathes through on the right. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-page via-page/85 to-page/10"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-page to-transparent"
      />

      {/* pointer-events-none keeps the chart hoverable outside the copy. */}
      <div className="pointer-events-none relative mx-auto flex h-full max-w-content flex-col justify-center px-5 py-16 sm:px-8 lg:px-12">
        <div className="pointer-events-auto max-w-2xl">
          <h1
            id="hero-heading"
            className="font-serif font-light leading-[1.05] tracking-[-0.01em]"
            style={{ fontSize: 'clamp(2.25rem, 4.6vw, 4.25rem)' }}
          >
            Wall Street, settled onchain.
          </h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-muted">
            Tokenized stocks and real-world assets, priced swap by swap in the Uniswap pools where
            they trade on Robinhood Chain. No legacy feeds, no oracles: every number traces to a
            pool you can check.
          </p>

          {/* Live readout: one quiet line, nothing boxed. */}
          {active && q && (
            <p className="mt-7 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-sm font-semibold uppercase tracking-[0.08em] text-muted">
                {active.symbol}
              </span>
              <span className="text-2xl font-medium tabular-nums">
                <PriceCell price={formatPrice(q.price)} />
              </span>
              <span className="text-sm">
                <ChangeLabel pct={q.changePct} />
              </span>
            </p>
          )}

          {/* Chart controls: quiet underline tabs. */}
          <div className="tab-scroll mt-9 flex max-w-xl gap-5 overflow-x-auto">
            {instruments.map((i) => (
              <button
                key={i.id}
                type="button"
                aria-pressed={i.id === active?.id}
                onClick={() => setSelected(i.id)}
                className={`h-7 shrink-0 border-b-2 text-xs font-medium transition-colors ${
                  i.id === active?.id
                    ? 'border-accent text-ink'
                    : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                {i.symbol}
              </button>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-5">
            <Link
              to="/markets"
              className="flex h-11 items-center whitespace-nowrap rounded-control bg-accent px-5 text-[15px] font-semibold text-ink transition-transform hover:-translate-y-px"
            >
              Explore markets
            </Link>
            <Link
              to="/docs"
              className="inline-flex items-center gap-1.5 whitespace-nowrap text-[15px] font-medium text-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
            >
              How it works <LuArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
