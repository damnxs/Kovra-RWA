import { Link, NavLink } from 'react-router-dom';
import { ConnectWalletButton } from './ConnectWalletButton';
import { useWallet, chainName } from '../data/WalletProvider';

const linkCls = ({ isActive }: { isActive: boolean }) =>
  `flex h-11 items-center rounded-control px-3 text-sm transition-colors ${
    isActive ? 'text-ink font-medium' : 'text-muted hover:text-ink'
  }`;

/**
 * One compact top navigation shared by public and connected surfaces
 * (dashboard-style.md): Markets / Portofolio / Agent / Activity truly centered
 * (equal 1fr side columns), network indicator and wallet on the right. No
 * persistent sidebar anywhere. Mobile: brand+wallet row, menu centered below.
 */
export function Nav() {
  const { address, chainId } = useWallet();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-page/90 backdrop-blur">
      <div className="mx-auto grid max-w-content grid-cols-[1fr_auto_1fr] items-center gap-y-1 px-5 py-3.5 sm:h-[72px] sm:gap-y-0 sm:px-8 sm:py-0 lg:px-12">
        <Link
          to="/"
          className="col-start-1 justify-self-start font-serif text-[26px] leading-none tracking-tight"
          aria-label="Kovra home"
        >
          kovra
        </Link>
        <div className="col-start-3 flex items-center justify-end">
          {/* Wallet's actual network — never a hardcoded "connected" indicator. */}
          {address && (
            <span className="hidden max-w-[140px] truncate rounded-control border border-line bg-surface px-2.5 py-1.5 text-xs text-muted md:inline-block">
              {chainName(chainId)}
            </span>
          )}
          <ConnectWalletButton />
        </div>
        <nav
          className="col-span-full row-start-2 flex flex-wrap items-center justify-center gap-1 sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:flex-nowrap sm:gap-2"
          aria-label="Primary"
        >
          <NavLink to="/markets" className={linkCls}>
            markets
          </NavLink>
          <NavLink to="/dashboard" className={linkCls}>
            portofolio
          </NavLink>
          <NavLink to="/agent" className={linkCls}>
            agent
          </NavLink>
          <NavLink to="/activity" className={linkCls}>
            activity
          </NavLink>
          <NavLink to="/docs" className={linkCls}>
            docs
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
