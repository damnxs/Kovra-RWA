import { useSyncExternalStore } from 'react';

/**
 * Local activity log. Only real actions performed in this app are recorded —
 * wallet connect/disconnect and watchlist changes. Onchain events
 * ('asset-detected', 'onchain-transfer') have no source yet and are never
 * fabricated; their kinds exist so verified events can land here later.
 */
export type ActivityKind =
  | 'wallet-connected'
  | 'wallet-disconnected'
  | 'watchlist-added'
  | 'watchlist-removed'
  | 'asset-detected'
  | 'onchain-transfer';

export type ActivitySource = 'wallet' | 'watchlist' | 'onchain';

export type ActivityEvent = {
  id: string;
  at: string; // ISO
  kind: ActivityKind;
  source: ActivitySource;
  symbol?: string;
  /** Value/amount — only when verifiable; local events never carry one. */
  value?: string;
  /** Transaction hash/link — only for real onchain events. */
  txHash?: string;
};

const KEY = 'kovra:activity';
const MAX_EVENTS = 200;
const DEDUPE_MS = 3_000;

const SOURCE_BY_KIND: Record<ActivityKind, ActivitySource> = {
  'wallet-connected': 'wallet',
  'wallet-disconnected': 'wallet',
  'watchlist-added': 'watchlist',
  'watchlist-removed': 'watchlist',
  'asset-detected': 'onchain',
  'onchain-transfer': 'onchain',
};

function read(): ActivityEvent[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => x && typeof x.id === 'string') : [];
  } catch {
    return []; // localStorage can throw (private mode, quota, disabled)
  }
}

let cache: ActivityEvent[] | null = null;
const listeners = new Set<() => void>();

function snapshot(): ActivityEvent[] {
  if (cache === null) cache = read();
  return cache;
}

function publish(next: ActivityEvent[]) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore — activity simply won't persist */
  }
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Cross-tab sync: another tab wrote the key.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    cache = null;
    for (const l of listeners) l();
  });
}

export function appendActivity(event: { kind: ActivityKind; symbol?: string }): void {
  const current = snapshot();
  const last = current[0];
  // The same action can arrive twice (e.g. connect() plus accountsChanged) — collapse it.
  if (
    last &&
    last.kind === event.kind &&
    last.symbol === event.symbol &&
    Date.now() - Date.parse(last.at) < DEDUPE_MS
  ) {
    return;
  }
  const next: ActivityEvent = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    source: SOURCE_BY_KIND[event.kind],
    ...event,
  };
  publish([next, ...current].slice(0, MAX_EVENTS));
}

export function useActivity(): ActivityEvent[] {
  return useSyncExternalStore(subscribe, snapshot, () => []);
}
