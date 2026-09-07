import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-content flex-col gap-8 px-5 py-10 sm:px-8 lg:flex-row lg:items-start lg:justify-between lg:px-12">
        <div className="max-w-sm">
          <p className="font-serif text-2xl leading-none">kovra</p>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Market discovery for tokenized exposure. Instruments shown are reference proxies, not
            purchasable products.
          </p>
        </div>
        <nav className="flex flex-col text-sm" aria-label="Footer">
          <Link to="/markets" className="flex min-h-11 items-center text-muted transition-colors hover:text-ink">
            Markets
          </Link>
          <Link to="/watchlist" className="flex min-h-11 items-center text-muted transition-colors hover:text-ink">
            Watchlist
          </Link>
          <Link to="/activity" className="flex min-h-11 items-center text-muted transition-colors hover:text-ink">
            Activity
          </Link>
          <Link to="/#insights" className="flex min-h-11 items-center text-muted transition-colors hover:text-ink">
            Insights
          </Link>
          <Link to="/docs" className="flex min-h-11 items-center text-muted transition-colors hover:text-ink">
            Docs
          </Link>
          <a
            href="/docs/provider-assessment.md"
            className="flex min-h-11 items-center text-muted transition-colors hover:text-ink"
            target="_blank"
            rel="noopener noreferrer"
          >
            Market data provider assessment
          </a>
        </nav>
        <div className="text-sm text-muted lg:text-right">
          <p>
            Market data:{' '}
            <a
              href="https://finnhub.io"
              className="underline decoration-line underline-offset-2 transition-colors hover:text-ink"
              target="_blank"
              rel="noopener noreferrer"
            >
              Finnhub
            </a>
          </p>
          <p className="mt-2 max-w-xs lg:ml-auto">
            Quotes may be delayed. Nothing here is investment advice or an offer of securities.
          </p>
          <p className="mt-2">© {new Date().getFullYear()} Kovra</p>
        </div>
      </div>
    </footer>
  );
}
