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
import type { OnchainEvent, OnchainStats, OnchainBalances, ChainLogEntry } from '../types/quote';
import { onStreamEvent } from './stream';

/**
 * Onchain data path (Robinhood Chain): the shared SSE subscription for the
 * live transfer feed, swap/TVL stats, and the live chain log, plus a polled
 * balances hook. Everything here is real chain data relayed by the Kovra
 * server, nothing simulated.
 */

type OnchainCtx = {
  /** Live transfer feed, newest first (capped; resets on reload). */
  events: OnchainEvent[];
  /** Real swap counts and USD volume per instrument since server connection. */
  stats: OnchainStats;
  /** Live chain log, newest first: blocks, swaps, transfers, TVL, node state. */
  log: ChainLogEntry[];
  /** Latest chain head from status pushes (null before the first status). */
  block: number | null;
  /** Chain connection state from the server (null before first status). */
  connected: boolean | null;
};

const Ctx = createContext<OnchainCtx | null>(null);
const MAX_EVENTS = 150;
// Block headers churn the log ~4/s; 600 keeps ≥1 minute of history alive for
// the Activity page's per-second pulse chart.
const MAX_LOG = 600;

export function OnchainProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<OnchainEvent[]>([]);
  const [stats, setStats] = useState<OnchainStats>({});
  const [log, setLog] = useState<ChainLogEntry[]>([]);
  const [block, setBlock] = useState<number | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const seen = useRef<Set<string>>(new Set());
  const seenLog = useRef<Set<string>>(new Set());

  const mergeLog = useCallback((incoming: ChainLogEntry[]) => {
    if (incoming.length === 0) return;
    setLog((prev) => {
      const next = [...prev];
      for (const e of incoming) {
        if (seenLog.current.has(e.id)) continue;
        seenLog.current.add(e.id);
        next.unshift(e);
      }
      if (next.length > MAX_LOG) next.length = MAX_LOG;
      return next;
    });
  }, []);

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
    // Initial ring + stats + log via REST, then live tail over the shared SSE.
    // Everything after load arrives as a push, never a poll.
    fetch('/api/onchain/feed')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: {
        events: OnchainEvent[];
        stats: OnchainStats;
        log: ChainLogEntry[];
        chain: { connected: boolean; blockNumber: number | null };
      }) => {
        merge(d.events);
        setStats(d.stats ?? {});
        mergeLog(d.log ?? []);
        setConnected(d.chain?.connected ?? null);
        setBlock(d.chain?.blockNumber ?? null);
      })
      .catch(() => setConnected(false));

    const offOnchain = onStreamEvent('onchain', (data) => {
      const d = data as { events: OnchainEvent[]; stats?: OnchainStats };
      merge(d.events);
      if (d.stats) setStats(d.stats);
    });
    const offLog = onStreamEvent('chainlog', (data) => mergeLog((data as { log: ChainLogEntry[] }).log));
    const offStatus = onStreamEvent('status', (data) => {
      const d = data as { chain?: { connected: boolean; blockNumber: number | null } };
      if (d.chain) {
        setConnected(d.chain.connected);
        setBlock(d.chain.blockNumber);
      }
    });
    return () => {
      offOnchain();
      offLog();
      offStatus();
    };
  }, [merge, mergeLog]);

  const value = useMemo(
    () => ({ events, stats, log, block, connected }),
    [events, stats, log, block, connected],
  );
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
