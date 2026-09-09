import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { appendActivity } from './activity';

/**
 * Wallet connection, identity only: the official Reown AppKit modal. It opens
 * on the wallet grid (installed browser wallets connect in one click, mobile
 * wallets via WalletConnect), never on a raw QR screen. Kovra holds no keys,
 * signs nothing, cannot move funds.
 */
type Eip1193 = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

/** Structural slice of the AppKit instance the app relies on. */
type AppKitModal = {
  open: () => Promise<void>;
  disconnect: () => Promise<void>;
  getAddressByChainNamespace: (ns: 'eip155') => string | undefined;
  getProvider: () => Eip1193 | null;
  subscribeState: (cb: (s: { open: boolean }) => void) => void;
  subscribeConnections: (cb: (s: { status?: string }) => void) => void;
  subscribeEvents: (cb: (e: { data?: { event?: string; properties?: { message?: string } } }) => void) => void;
};

type WalletState = {
  /** True when a browser wallet (window.ethereum) is installed. */
  hasProvider: boolean;
  address: string | null;
  chainId: string | null;
  connecting: boolean;
  error: string | null;
  /** Opens the Reown modal. */
  connect: () => void;
  disconnect: () => void;
  /** True when the wallet is on Robinhood Chain (chainId 4663 = 0x1237). */
  onRobinhoodChain: boolean;
  /** Offer the wallet the Robinhood Chain network (wallet_addEthereumChain). Non-blocking. */
  switchToRobinhoodChain: () => Promise<void>;
};

const WalletContext = createContext<WalletState | null>(null);

/** Robinhood Chain, Arbitrum Orbit L2, chainId 4663. */
export const RH_CHAIN_ID = '0x1237';

/** AppKit network descriptor. The public HTTPS fallback RPC; identity only, so it is never used for a request here. */
const RH_NETWORK = {
  id: 4663,
  caipNetworkId: 'eip155:4663',
  chainNamespace: 'eip155',
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.mainnet.chain.robinhood.com'] } },
  blockExplorers: { default: { name: 'RH Scan', url: 'https://rh-scan.com' } },
};

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

/** Wallet's actual network name, whatever the wallet reports, no assumptions. */
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
  } catch { /* storage unavailable, clearing state below is then the only guard */ }
}

function clearDisconnectedFlag() {
  try {
    localStorage.removeItem(DISCONNECTED_FLAG);
  } catch { /* nothing to clear */ }
}

/** True when a WalletConnect session exists in storage (keys are `wc@2:*`). */
function hasWcSession(): boolean {
  try {
    return Object.keys(localStorage).some((k) => k.startsWith('wc@2'));
  } catch {
    return false;
  }
}

function toHexChainId(id: number | string): string {
  return typeof id === 'string' && id.startsWith('0x') ? id : `0x${Number(id).toString(16)}`;
}

/** AppKit's global augmentation widens window.ethereum; cast at the boundary. */
export function injected(): Eip1193 | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.ethereum as Eip1193 | undefined;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const appKitRef = useRef<AppKitModal | null>(null);
  const appKitInitRef = useRef<Promise<AppKitModal> | null>(null);
  const wiredProviderRef = useRef<Eip1193 | null>(null);

  // wallet_addEthereumChain params come from the server (single source of truth:
  // the RPC URL is server config, not shipped in the client bundle).
  const chainParamsRef = useRef<Record<string, unknown> | null>(null);
  const getChainParams = useCallback(async () => {
    if (chainParamsRef.current) return chainParamsRef.current;
    const res = await fetch('/api/chain-config');
    if (!res.ok) throw new Error('chain-config-unavailable');
    chainParamsRef.current = (await res.json()) as Record<string, unknown>;
    return chainParamsRef.current;
  }, []);

  /** One transition point for the connected address, activity logged once per direction. */
  const applyAddress = useCallback((next: string | null) => {
    setAddress((prev) => {
      if (prev === next) return prev;
      if (next && !prev) {
        appendActivity({ kind: 'wallet-connected' });
        clearDisconnectedFlag();
      }
      // Sticky on every disconnect path (ours or the modal's), so reload cannot
      // silently restore a session the user just ended.
      if (!next && prev) {
        appendActivity({ kind: 'wallet-disconnected' });
        setDisconnectedFlag();
      }
      return next;
    });
  }, []);

  /**
   * Track the real chain of whichever provider owns the session. AppKit's own
   * network state can only hold chains it was configured with, so chainChanged
   * on the live provider is the honest source.
   */
  const wireProvider = useCallback((prov: Eip1193 | null) => {
    if (!prov?.on || wiredProviderRef.current === prov) return;
    wiredProviderRef.current = prov;
    prov.on('chainChanged', (...args: unknown[]) => {
      const [cid] = args;
      if (cid) setChainId(toHexChainId(cid as string));
    });
    prov
      .request({ method: 'eth_chainId' })
      .then((id) => {
        if (id) setChainId(id as string);
      })
      .catch(() => {});
  }, []);

  /** Pull identity truth out of AppKit into React state, idempotent. */
  const syncFromAppKit = useCallback(() => {
    const appKit = appKitRef.current;
    if (!appKit) return;
    applyAddress(appKit.getAddressByChainNamespace('eip155') ?? null);
    wireProvider(appKit.getProvider());
  }, [applyAddress, wireProvider]);

  /** Create the AppKit instance once (needs a projectId from cloud.reown.com). */
  const initAppKit = useCallback(async (): Promise<AppKitModal> => {
    if (appKitInitRef.current) return appKitInitRef.current;
    const init = (async () => {
      const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;
      if (!projectId) throw new Error('walletconnect-unconfigured');
      // The EthersAdapter is what lets the modal list and one-click connect
      // installed browser wallets (injected + EIP-6963); adapter-less AppKit
      // can only do the WalletConnect protocol.
      const { createAppKit } = (await import('@reown/appkit')) as unknown as {
        createAppKit: (options: Record<string, unknown>) => AppKitModal;
      };
      const { EthersAdapter } = (await import('@reown/appkit-adapter-ethers')) as unknown as {
        EthersAdapter: new () => unknown;
      };
      const appKit = createAppKit({
        adapters: [new EthersAdapter()],
        networks: [RH_NETWORK],
        defaultNetwork: RH_NETWORK,
        projectId,
        metadata: {
          name: 'Kovra',
          description: 'Stocks onchain. Read-only wallet connection, Kovra never moves funds.',
          url: window.location.origin,
          icons: [], // no favicon yet; wallets fall back to their default logo
        },
        enableWalletConnect: true,
        enableEIP6963: true,
        enableInjected: true,
        allowUnsupportedChain: true,
        features: {
          email: false,
          socials: false,
          analytics: false,
          swaps: false,
          onramp: false,
          send: false,
          history: false,
          allWallets: true,
        },
        themeMode: 'light',
        themeVariables: {
          '--w3m-font-family': "'Geist Sans', system-ui, sans-serif",
          '--w3m-accent': '#1d1d1d',
          '--w3m-color-mix': '#f5f3ea',
          '--w3m-z-index': '60',
        },
      });
      appKit.subscribeState((s) => {
        if (!s.open) setConnecting(false); // modal closed: connect attempt is over either way
        syncFromAppKit();
      });
      appKit.subscribeConnections(() => syncFromAppKit());
      appKit.subscribeEvents((e) => {
        if (e.data?.event === 'CONNECT_ERROR') {
          console.error('[kovra] wallet connect error:', e.data.properties?.message);
          setError(`WalletConnect: ${e.data.properties?.message || 'the wallet could not be connected.'}`);
        }
      });
      appKitRef.current = appKit;
      return appKit;
    })();
    appKitInitRef.current = init;
    init.catch(() => {
      appKitInitRef.current = null; // a failed init can be retried
    });
    return init;
  }, [syncFromAppKit]);

  /** Best-effort: add/switch the wallet to Robinhood Chain. A rejection is not an error. */
  const switchToRobinhoodChain = useCallback(async () => {
    const eth = appKitRef.current?.getProvider() ?? injected();
    if (!eth) return;
    try {
      const params = await getChainParams();
      await eth.request({ method: 'wallet_addEthereumChain', params: [params] });
      // wallet_addEthereumChain switches too when the chain exists; verify either way.
      await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: RH_CHAIN_ID }] });
      setChainId(RH_CHAIN_ID);
    } catch {
      /* declined or unsupported, the wallet keeps its network; UI keeps showing it */
    }
  }, [getChainParams]);

  // Silent restore: injected accounts via eth_accounts (no prompt, no SDK
  // download for idle boots), WalletConnect sessions resume through AppKit's
  // own reconnect. Skipped after a user disconnect, until they connect again.
  useEffect(() => {
    let userDisconnected = false;
    try {
      userDisconnected = localStorage.getItem(DISCONNECTED_FLAG) === '1';
    } catch { /* storage unavailable, restore is then always attempted */ }
    if (!userDisconnected && hasWcSession()) void initAppKit().catch(() => {});

    const eth = injected();
    if (!userDisconnected && eth) {
      eth
        .request({ method: 'eth_accounts' })
        .then((accounts) => {
          const [first] = (accounts ?? []) as string[];
          if (first) applyAddress(first);
        })
        .catch(() => {});
      // chainChanged only fires on a switch, so the current chain needs an explicit read.
      eth
        .request({ method: 'eth_chainId' })
        .then((id) => {
          if (id) setChainId(id as string);
        })
        .catch(() => {});
    }

    const onAccounts = (...args: unknown[]) => {
      const [first] = (args[0] ?? []) as string[];
      applyAddress(first ?? null);
    };
    const onChain = (...args: unknown[]) => {
      if (args[0]) setChainId(toHexChainId(args[0] as string));
    };
    eth?.on?.('accountsChanged', onAccounts);
    eth?.on?.('chainChanged', onChain);
    return () => {
      eth?.removeListener?.('accountsChanged', onAccounts);
      eth?.removeListener?.('chainChanged', onChain);
    };
  }, [initAppKit, applyAddress]);

  /** Opens the Reown modal on the wallet grid. */
  const connect = useCallback(() => {
    setError(null);
    setConnecting(true);
    initAppKit()
      .then((appKit) => appKit.open())
      .catch((e: unknown) => {
        console.error('[kovra] wallet connect failed:', e);
        setConnecting(false);
        const message = (e as Error).message ?? '';
        setError(
          message === 'walletconnect-unconfigured'
            ? 'WalletConnect is not configured. Add VITE_WALLETCONNECT_PROJECT_ID to .env (free at cloud.reown.com).'
            : `WalletConnect: ${message || 'the wallet could not be connected.'}`,
        );
      });
  }, [initAppKit]);

  // Disconnect must actually hold: the sticky flag now comes from applyAddress,
  // this kills the AppKit session (WalletConnect or injected).
  const disconnect = useCallback(() => {
    applyAddress(null);
    setError(null);
    appKitRef.current?.disconnect().catch(() => {});
  }, [applyAddress]);

  return (
    <WalletContext.Provider
      value={{
        hasProvider: !!injected(),
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
