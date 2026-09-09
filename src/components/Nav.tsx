import { Link, NavLink } from 'react-router-dom';
import { ConnectWalletButton } from './ConnectWalletButton';

const tabs = [
  { to: '/markets', label: 'markets' },
  { to: '/dashboard', label: 'portfolio' },
  { to: '/agent', label: 'agent' },
  { to: '/activity', label: 'activity' },
  { to: '/docs', label: 'guide' },
];

const linkCls = ({ isActive }: { isActive: boolean }) =>
  `flex h-11 items-center px-3 text-[11px] font-medium uppercase tracking-[0.12em] transition-colors ${
    isActive ? 'text-ink' : 'text-muted hover:text-ink'
  }`;

/**
 * One compact top navigation shared by public and connected surfaces
 * (dashboard-style.md): Markets / Portofolio / Agent / Activity truly centered
 * (equal 1fr side columns), wallet on the right. No persistent sidebar
 * anywhere. Mobile: logo and wallet on the first row, tabs scroll directly
 * under them; no fixed bottom bar.
 */
export function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-page/90 backdrop-blur">
      <div className="mx-auto grid max-w-content grid-cols-[1fr_auto_1fr] items-center px-5 py-3.5 sm:h-[72px] sm:px-8 sm:py-0 lg:px-12">
        <Link
          to="/"
          className="col-start-1 row-start-1 flex h-11 items-center justify-self-start"
          aria-label="Kovra home"
        >
          <img src="/logo.png" alt="Kovra" className="h-7 w-auto" />
        </Link>
        {/* row-start-1 pinned: without it, grid auto-placement wraps the nav
            onto a second row, because col 2 sits before the wallet's col 3 in
            placement order but after it in DOM order. */}
        <nav
          className="col-start-2 row-start-1 hidden h-11 items-center justify-center gap-2 sm:flex"
          aria-label="Primary"
        >
          {tabs.map(({ to, label }) => (
            <NavLink key={to} to={to} className={linkCls}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="col-start-3 row-start-1 flex h-11 items-center justify-end">
          <ConnectWalletButton />
        </div>
      </div>

      {/* Mobile menu: same tabs, one thin row under the logo. */}
      <nav className="tab-scroll flex items-stretch border-t border-line px-5 sm:hidden" aria-label="Primary">
        {tabs.map(({ to, label }) => (
          <NavLink key={to} to={to} className={linkCls}>
            {label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
