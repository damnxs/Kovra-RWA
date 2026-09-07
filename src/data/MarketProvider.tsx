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
import type { Instrument, Quote, Status, HistoryPoint } from '../types/quote';

/**
 * Single client data path. One shared 60-second refresh loop for the whole app —
 * never per visitor, never per page. Labels say "auto-updated", never "live".
 */
export type Conn = 'connecting' | 'ok' | 'error';

type MarketCtx = {
  instruments: Instrument[];
  quotes: Record<string, Quote>;
  points: Record<string, HistoryPoint[]>;
  status: Status | null;
  conn: Conn;
  /** True while a refresh round-trip is in flight (small "Updating…" state). */
  refreshing: boolean;
  /** Epoch ms of the last successful quotes fetch — drives "Updated Xs ago". */
  lastUpdatedAt: number | null;
  /** Force an immediate refresh (Retry button). */
  retry: () => void;
};

const Ctx = createContext<MarketCtx | null>(null);

const REFRESH_MS = 60_000;
const MAX_POINTS = 720;

function appendPoint(ring: HistoryPoint[] | undefined, p: HistoryPoint): HistoryPoint[] {
  const base = ring ?? [];
  const last = base[base.length - 1];
  if (last && last.t >= p.t) return base; // ignore out-of-order / duplicate events
  const next = [...base, p];
  if (next.length > MAX_POINTS) next.splice(0, next.length - MAX_POINTS);
  return next;
}

export function MarketProvider({ children }: { children: ReactNode }) {
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [points, setPoints] = useState<Record<string, HistoryPoint[]>>({});
  const [status, setStatus] = useState<Status | null>(null);
  const [conn, setConn] = useState<Conn>('connecting');
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  const inFlightRef = useRef(false);
  const lastOkRef = useRef(0);
  const instrumentsRef = useRef<Instrument[]>([]);
  useEffect(() => {
    instrumentsRef.current = instruments;
  }, [instruments]);

  const mergeQuotes = useCallback((incoming: Quote[]) => {
    if (incoming.length === 0) return;
    setQuotes((prev) => {
      const next = { ...prev };
      for (const q of incoming) next[q.instrumentId] = q;
      return next;
    });
    // Grow the since-connection series locally from the same real events.
    setPoints((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const q of incoming) {
        const grown = appendPoint(next[q.instrumentId], { t: Date.parse(q.sourceTimestamp), p: q.price });
        if (grown !== next[q.instrumentId]) {
          next[q.instrumentId] = grown;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  const mergeHistory = useCallback((id: string, incoming: HistoryPoint[] | undefined) => {
    if (!incoming || incoming.length === 0) return;
    setPoints((prev) => {
      let next = prev[id] ?? [];
      for (const p of incoming) next = appendPoint(next, p);
      if (next === prev[id]) return prev;
      return { ...prev, [id]: next };
    });
  }, []);

  const tick = useCallback(async () => {
    if (inFlightRef.current) return; // no duplicate concurrent requests
    inFlightRef.current = true;
    setRefreshing(true);
    try {
      const [quotesRes, ...historyRes] = await Promise.all([
        fetch('/api/quotes'),
        ...instrumentsRef.current.map((i) => fetch(`/api/history?id=${encodeURIComponent(i.id)}`)),
      ]);
      if (!quotesRes.ok) throw new Error(`HTTP ${quotesRes.status}`);
      const data = (await quotesRes.json()) as { quotes: Quote[]; status: Status };
      mergeQuotes(data.quotes);
      setStatus(data.status);
      lastOkRef.current = Date.now();
      setLastUpdatedAt(lastOkRef.current);
      setConn('ok');
      for (let i = 0; i < historyRes.length; i++) {
        const inst = instrumentsRef.current[i];
        if (!inst || !historyRes[i]!.ok) continue;
        const h = (await historyRes[i]!.json()) as { points?: HistoryPoint[] };
        mergeHistory(inst.id, h.points);
      }
    } catch {
      setConn('error'); // server unreachable — keep last known data visible
    } finally {
      inFlightRef.current = false;
      setRefreshing(false);
    }
  }, [mergeHistory, mergeQuotes]);

  const retry = useCallback(() => {
    void tick();
  }, [tick]);

  useEffect(() => {
    fetch('/api/markets')
      .then((r) => r.json())
      .then((d: { instruments: Instrument[] }) => setInstruments(d.instruments))
      .catch(() => setInstruments([]));
  }, []);

  useEffect(() => {
    void tick();
    const interval = setInterval(() => {
      if (document.hidden) return; // don't queue requests in background tabs
      void tick();
    }, REFRESH_MS);
    // After the tab comes back, refresh immediately if the data is stale.
    const onVisible = () => {
      if (!document.hidden && Date.now() - lastOkRef.current > REFRESH_MS - 5_000) void tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [tick]);

  const value = useMemo(
    () => ({ instruments, quotes, points, status, conn, refreshing, lastUpdatedAt, retry }),
    [instruments, quotes, points, status, conn, refreshing, lastUpdatedAt, retry],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMarket(): MarketCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useMarket must be used inside MarketProvider');
  return ctx;
}
