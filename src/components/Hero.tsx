import { Link } from 'react-router-dom';

export function Hero() {
  return (
    <section
      className="relative overflow-hidden border-b border-line"
      style={{ minHeight: 'clamp(420px, 48vh, 520px)' }}
      aria-labelledby="hero-heading"
    >
      {/* Abstract fine grid fading into the page toward the right, with a soft
          localized lime gradient behind it. Decorative only — never a price signal. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(560px 420px at 18% 42%, color-mix(in srgb, #ccff00 26%, transparent), transparent 68%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(to right, #dfe4d6 1px, transparent 1px), linear-gradient(to bottom, #dfe4d6 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'linear-gradient(to right, rgba(0,0,0,0.75), transparent 78%)',
          WebkitMaskImage: 'linear-gradient(to right, rgba(0,0,0,0.75), transparent 78%)',
        }}
      />

      <div className="relative mx-auto flex h-full max-w-content items-center px-5 py-16 sm:px-8 lg:px-12">
        <div className="max-w-2xl">
          <p className="eyebrow">Onchain RWA · Market discovery</p>
          <h1
            id="hero-heading"
            className="mt-4 font-serif leading-[1.05] tracking-[-0.01em]"
            style={{ fontSize: 'clamp(2.5rem, 5.4vw, 5.25rem)' }}
          >
            Know the market before you enter.
          </h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-muted">
            Explore tokenized market exposure with clear data and intelligent context.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#markets"
              className="flex h-12 items-center whitespace-nowrap rounded-control bg-accent px-6 text-[15px] font-semibold text-ink transition-transform hover:-translate-y-px"
            >
              Explore markets
            </a>
            <Link
              to="/docs"
              className="flex h-12 items-center whitespace-nowrap rounded-control border border-line bg-surface px-6 text-[15px] font-medium text-ink transition-colors hover:border-ink"
            >
              How Kovra works
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
