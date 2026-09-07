import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { appendActivity } from './activity';

/**
 * Minimal EIP-1193 injected-wallet connection — identity only.
 * Kovra holds no keys, signs nothing, and cannot move funds. No SDK needed.
 */
type Eip1193 = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
};

declare global {
  interface Window {
    ethereum?: Eip1193;
  }
}

type WalletState = {
  hasProvider: boolean;
  address: string | null;
  chainId: string | null;
  connecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  /** True when the wallet is on Robinhood Chain (chainId 4663 = 0x1237). */
  onRobinhoodChain: boolean;
  /** Offer the wallet the Robinhood Chain network (wallet_addEthereumChain). Non-blocking. */
  switchToRobinhoodChain: () => Promise<void>;
};

const WalletContext = createContext<WalletState | null>(null);

/** Robinhood Chain — Arbitrum Orbit L2, chainId 4663. */
export const RH_CHAIN_ID = '0x1237';

const CHAIN_NAMES: Record<string, string> = {
  '0x1': 'Ethereum',
  '0xaa36a7': 'Sepolia',
  '0x89': 'Polygon PoS',
  '0xa': 'Optimism',
  '0xa4b1': 'Arbitrum One',
  '0x2105': 'Base',
  '0x38': 'BNB Chain',
  [RH_CHAIN_ID]: 'Robinhood Chain',
};

/** Wallet's actual network name — whatever the wallet reports, no assumptions. */
export function chainName(chainId: string | null): string {
  if (!chainId) return 'Unknown network';
  return CHAIN_NAMES[chainId] ?? `Chain #${parseInt(chainId, 16)}`;
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** Set while the user has disconnected here: suppresses silent restore until they reconnect. */
const DISCONNECTED_FLAG = 'kovra:wallet-disconnected';

function setDisconnectedFlag() {
  try {
    localStorage.setItem(DISCONNECTED_FLAG, '1');
  } catch { /* storage unavailable — revoke below is then the only guard */ }
}

function clearDisconnectedFlag() {
  try {
    localStorage.removeItem(DISCONNECTED_FLAG);
  } catch { /* nothing to clear */ }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // wallet_addEthereumChain params come from the server (single source of truth —
  // the RPC URL is server config, not shipped in the client bundle).
  const chainParamsRef = useRef<Record<string, unknown> | null>(null);
  const getChainParams = useCallback(async () => {
    if (chainParamsRef.current) return chainParamsRef.current;
    const res = await fetch('/api/chain-config');
    if (!res.ok) throw new Error('chain-config-unavailable');
    chainParamsRef.current = (await res.json()) as Record<string, unknown>;
    return chainParamsRef.current;
  }, []);

  /** Best-effort: add/switch the wallet to Robinhood Chain. A rejection is not an error. */
  const switchToRobinhoodChain = useCallback(async () => {
    const eth = window.ethereum;
    if (!eth) return;
    try {
      const params = await getChainParams();
      await eth.request({ method: 'wallet_addEthereumChain', params: [params] });
      // wallet_addEthereumChain switches too when the chain exists; verify either way.
      await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: RH_CHAIN_ID }] });
      setChainId(RH_CHAIN_ID);
    } catch {
      /* declined or unsupported — the wallet keeps its network; UI keeps showing it */
    }
  }, [getChainParams]);

  useEffect(() => {
    const eth = window.ethereum;
    if (!eth) return;
    // Silent restore: eth_accounts only reveals accounts already authorized — no prompt.
    // Skipped after a user disconnect, until they explicitly connect again.
    let userDisconnected = false;
    try {
      userDisconnected = localStorage.getItem(DISCONNECTED_FLAG) === '1';
    } catch { /* storage unavailable — restore is then always attempted */ }
    if (!userDisconnected) {
      eth.request({ method: 'eth_accounts' }).then((accounts) => {
        const [first] = (accounts ?? []) as string[];
        if (first) setAddress(first);
      }).catch(() => {});
    }
    eth.request({ method: 'eth_chainId' }).then((id) => setChainId(id as string)).catch(() => {});

    const onAccounts = (...args: unknown[]) => {
      const [first] = (args[0] ?? []) as string[];
      setAddress((prev) => {
        // Wallet-side state change: log the transition once per direction.
        if (first && !prev) appendActivity({ kind: 'wallet-connected' });
        if (!first && prev) appendActivity({ kind: 'wallet-disconnected' });
        return first ?? null;
      });
      if (first) clearDisconnectedFlag(); // wallet-side (re)connect honors the account again
    };
    const onChain = (...args: unknown[]) => setChainId(args[0] as string);
    eth.on('accountsChanged', onAccounts);
    eth.on('chainChanged', onChain);
    return () => {
      eth.removeListener('accountsChanged', onAccounts);
      eth.removeListener('chainChanged', onChain);
    };
  }, []);

  const connect = useCallback(async () => {
    const eth = window.ethereum;
    if (!eth) {
      setError('No wallet detected. Install an EVM wallet such as MetaMask, or open Kovra in your wallet browser.');
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[];
      const [first] = accounts ?? [];
      if (!first) {
        setError('No account was shared by the wallet.');
        return;
      }
      setAddress(first);
      clearDisconnectedFlag(); // an explicit connect re-enables silent restore for next visit
      appendActivity({ kind: 'wallet-connected' });
      const current = ((await eth.request({ method: 'eth_chainId' })) as string) ?? null;
      setChainId(current);
      // Offer Robinhood Chain after connect — the wallet asks, the user decides.
      if (current !== RH_CHAIN_ID) void switchToRobinhoodChain();
    } catch (e) {
      const code = (e as { code?: number }).code;
      setError(code === 4001 ? 'Connection request was declined.' : 'The wallet could not be connected.');
    } finally {
      setConnecting(false);
    }
  }, [switchToRobinhoodChain]);

  // Disconnect must actually hold: mark it locally (survives reload, blocks silent
  // eth_accounts restore) and best-effort revoke the wallet-side authorization.
  // wallet_revokePermissions is MetaMask-and-friends; unsupported wallets just keep
  // their own authorization, but the flag keeps Kovra itself disconnected.
  const disconnect = useCallback(() => {
    setAddress((prev) => {
      if (prev) appendActivity({ kind: 'wallet-disconnected' });
      return null;
    });
    setError(null);
    setDisconnectedFlag();
    window.ethereum
      ?.request({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] })
      .catch(() => {});
  }, []);

  return (
    <WalletContext.Provider
      value={{
        hasProvider: typeof window !== 'undefined' && !!window.ethereum,
        address,
        chainId,
        connecting,
        error,
        connect,
        disconnect,
        onRobinhoodChain: chainId === RH_CHAIN_ID,
        switchToRobinhoodChain,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used inside WalletProvider');
  return ctx;
}
