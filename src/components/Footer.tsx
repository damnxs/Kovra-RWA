import { Link } from 'react-router-dom';

/** Dark infra section (style.md #11): deep green-black, ivory, thin rules. */
export function Footer() {
  return (
    <footer className="border-t border-line-dark bg-deep text-ivory">
      <div className="mx-auto flex max-w-content flex-col gap-8 px-5 py-10 sm:px-8 lg:flex-row lg:items-start lg:justify-between lg:px-12">
        <div className="max-w-sm">
          <p className="font-serif text-2xl leading-none">kovra</p>
          <p className="mt-3 text-sm leading-relaxed text-fog">
            Live price discovery for tokenized stocks and real-world assets on Robinhood Chain.
            Everything here is research; nothing can be bought or sold through Kovra.
          </p>
        </div>
        <nav className="flex flex-col text-sm" aria-label="Footer">
          <Link
            to="/markets"
            className="flex min-h-11 items-center text-fog transition-colors hover:text-ivory"
          >
            Markets
          </Link>
          <Link
            to="/watchlist"
            className="flex min-h-11 items-center text-fog transition-colors hover:text-ivory"
          >
            Watchlist
          </Link>
          <Link
            to="/activity"
            className="flex min-h-11 items-center text-fog transition-colors hover:text-ivory"
          >
            Activity
          </Link>
          <Link
            to="/dashboard"
            className="flex min-h-11 items-center text-fog transition-colors hover:text-ivory"
          >
            Portfolio
          </Link>
          <Link
            to="/docs"
            className="flex min-h-11 items-center text-fog transition-colors hover:text-ivory"
          >
            Guide
          </Link>
        </nav>
        <div className="text-sm text-fog lg:text-right">
          <p className="micro text-fog">Source: onchain</p>
          <p className="mt-2 max-w-xs lg:ml-auto">
            Prices are indicative onchain pool prices. Nothing here is investment advice or an offer
            of securities.
          </p>
          <p className="micro mt-4 text-fog">© {new Date().getFullYear()} Kovra</p>
        </div>
      </div>
    </footer>
  );
}
