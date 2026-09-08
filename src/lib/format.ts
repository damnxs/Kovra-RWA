const priceFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatPrice(price: string | null | undefined): string {
  const n = Number(price);
  if (price === null || price === undefined || !Number.isFinite(n)) return 'n/a';
  return priceFmt.format(n);
}

/** Always signed; returns null when the value is unavailable (never fake it). */
export function formatPct(pct: number | null | undefined): string | null {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return null;
  const sign = pct > 0 ? '+' : pct < 0 ? '−' : '';
  return `${sign}${Math.abs(pct).toFixed(2)}%`;
}

/** Visible direction word so change is never color-only. */
export function directionWord(pct: number | null | undefined): string | null {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return null;
  if (pct > 0) return 'Up';
  if (pct < 0) return 'Down';
  return 'Flat';
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return 'n/a';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'n/a';
  const sameDay = new Date().toDateString() === d.toDateString();
  const time = d.toLocaleTimeString('en-US', { hour12: false });
  return sameDay ? time : `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${time}`;
}

/** 'Updated 12s ago' / 'Updated 3m ago' relative to now. */
/** Compact USD for log/stat lines: $1.23M, $456.7K, $12.34. */
export function formatUsdCompact(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return 'n/a';
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

export function formatAgo(iso: string | null | undefined, now: number = Date.now()): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 5) return 'Updated just now';
  if (s < 60) return `Updated ${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `Updated ${m}m ago`;
  const h = Math.floor(m / 60);
  return `Updated ${h}h ago`;
}

