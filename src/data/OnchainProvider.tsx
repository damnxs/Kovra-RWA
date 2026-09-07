import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { OnchainEvent, OnchainStats, OnchainBalances } from '../types/quote';

/**
 * Onchain data path (Robinhood Chain): one shared SSE subscription for the live
 * transfer feed, plus a polled balances hook. Everything here is real chain
 * data relayed by the Kovra server — nothing simulated.
 */

type OnchainCtx = {
  /** Live transfer feed, newest first (capped; resets on reload). */
  events: OnchainEvent[];
  /** Real swap counts and USD volume per instrument since server connection. */
  stats: OnchainStats;
  /** Chain connection state from the server (null before first status). */
  connected: boolean | null;
};

const Ctx = createContext<OnchainCtx | null>(null);
const MAX_EVENTS = 150;

export function OnchainProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<OnchainEvent[]>([]);
  const [stats, setStats] = useState<OnchainStats>({});
  const [connected, setConnected] = useState<boolean | null>(null);
  const seen = useRef<Set<string>>(new Set());

  const merge = useCallback((incoming: OnchainEvent[]) => {
    if (incoming.length === 0) return;
    setEvents((prev) => {
      const next = [...prev];
      for (const e of incoming) {
        if (seen.current.has(e.id)) continue;
        seen.current.add(e.id);
        next.unshift(e);
      }
      if (next.length > MAX_EVENTS) next.length = MAX_EVENTS;
      return next;
    });
  }, []);

  useEffect(() => {
    // Initial ring via REST, then live tail via SSE. Reconnect is EventSource's own.
    fetch('/api/onchain/feed')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { events: OnchainEvent[]; stats: OnchainStats; chain: { connected: boolean } }) => {
        merge(d.events);
        setStats(d.stats ?? {});
        setConnected(d.chain?.connected ?? null);
      })
      .catch(() => setConnected(false));

    const es = new EventSource('/api/stream');
    es.addEventListener('onchain', (ev) => {
      const d = JSON.parse((ev as MessageEvent).data) as { events: OnchainEvent[] };
      merge(d.events);
    });
    es.addEventListener('status', (ev) => {
      const d = JSON.parse((ev as MessageEvent).data) as { chain?: { connected: boolean } };
      if (d.chain) setConnected(d.chain.connected);
    });
    return () => es.close();
  }, [merge]);

  const value = useMemo(() => ({ events, stats, connected }), [events, stats, connected]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOnchainFeed(): OnchainCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useOnchainFeed must be used inside OnchainProvider');
  return ctx;
}

// ---- Balances ---------------------------------------------------------------------

type BalancesState = {
  data: OnchainBalances | null;
  loading: boolean;
  error: string | null;
};

/** Real wallet balances on Robinhood Chain; refreshes every 60s while mounted. */
export function useOnchainBalances(address: string | null): BalancesState {
  const [state, setState] = useState<BalancesState>({ data: null, loading: false, error: null });
  const addrRef = useRef<string | null>(null);

  useEffect(() => {
    if (!address) return;
    addrRef.current = address;
    let alive = true;

    const load = async () => {
      setState((s) => ({ ...s, loading: true }));
      try {
        const res = await fetch(`/api/onchain/balances?address=${address}`);
        if (!alive || addrRef.current !== address) return;
        if (res.status === 503) {
          setState({ data: null, loading: false, error: 'chain-unavailable' });
          return;
        }
        if (!res.ok) throw new Error(String(res.status));
        setState({ data: (await res.json()) as OnchainBalances, loading: false, error: null });
      } catch {
        if (alive && addrRef.current === address) {
          setState({ data: null, loading: false, error: 'fetch-failed' });
        }
      }
    };

    void load();
    const t = setInterval(() => {
      if (!document.hidden) void load();
    }, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [address]);

  // Drop stale data after a wallet switch without a synchronous reset in the effect.
  const mine = state.data && address && state.data.address.toLowerCase() === address.toLowerCase();
  return {
    data: mine ? state.data : null,
    loading: address ? state.loading && !mine : false,
    error: mine ? state.error : null,
  };
}

/** Real ERC-20 transfer history of the connected wallet (~4h window). */
export function fetchWalletTransfers(address: string): Promise<OnchainEvent[]> {
  return fetch(`/api/onchain/transfers?address=${address}`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((d: { events: OnchainEvent[] }) => d.events);
}
