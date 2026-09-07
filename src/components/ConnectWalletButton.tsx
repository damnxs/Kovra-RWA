import { Link, useNavigate } from 'react-router-dom';
import { useWallet, shortAddress } from '../data/WalletProvider';

/**
 * Secondary nav action: outline "Connect wallet" when disconnected; the connected
 * state becomes an address chip linking to the dashboard. Routed on connect.
 */
export function ConnectWalletButton({ navigateOnConnect = true }: { navigateOnConnect?: boolean }) {
  const { address, connecting, connect } = useWallet();
  const navigate = useNavigate();

  if (address) {
    return (
      <Link
        to="/dashboard"
        className="ml-2 flex h-11 items-center gap-2 rounded-control border border-line bg-surface px-4 text-sm font-medium transition-colors hover:border-ink"
        aria-label={`Open dashboard for ${shortAddress(address)}`}
      >
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-positive" />
        <span className="tabular-nums">{shortAddress(address)}</span>
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={connecting}
      onClick={() => {
        // Transition to the dashboard immediately (fade); the connection request
        // continues there and the dashboard opens the moment it completes.
        if (navigateOnConnect) navigate('/dashboard');
        connect();
      }}
      className="ml-2 flex h-11 items-center rounded-control border border-line bg-surface px-4 text-sm font-medium transition-colors hover:border-ink disabled:opacity-60"
    >
      {connecting ? 'Connecting…' : 'Connect wallet'}
    </button>
  );
}
