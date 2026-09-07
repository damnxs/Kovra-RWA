import type { Instrument, Quote } from '../types/quote';

/** Deterministic category concentration of a watchlist (share of watched count). Pure. */
export function concentration(
  watchIds: string[],
  instruments: Instrument[],
): Array<{ category: string; count: number; pct: number }> {
  const watched = instruments.filter((i) => watchIds.includes(i.id));
  if (watched.length === 0) return [];
  const byCat = new Map<string, number>();
  for (const i of watched) byCat.set(i.category, (byCat.get(i.category) ?? 0) + 1);
  return [...byCat.entries()]
    .map(([category, count]) => ({ category, count, pct: Math.round((count / watched.length) * 100) }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
}

export type MoverRow = { instrument: Instrument; changePct: number };

/** Deterministic movers: instruments sorted by today's change vs previous close. Pure. */
export function movers(
  quotes: Record<string, Quote>,
  instruments: Instrument[],
): { gainers: MoverRow[]; losers: MoverRow[]; unavailable: Instrument[] } {
  const rows: MoverRow[] = [];
  const unavailable: Instrument[] = [];
  for (const inst of instruments) {
    const q = quotes[inst.id];
    if (q && q.changePct !== null && q.changePct !== undefined && Number.isFinite(q.changePct)) {
      rows.push({ instrument: inst, changePct: q.changePct });
    } else {
      unavailable.push(inst);
    }
  }
  rows.sort((a, b) => b.changePct - a.changePct || a.instrument.symbol.localeCompare(b.instrument.symbol));
  // Split by sign so an instrument can never appear as both gainer and loser.
  const gainers = rows.filter((r) => r.changePct > 0);
  const losers = rows.filter((r) => r.changePct < 0).reverse(); // biggest decline first
  return { gainers, losers, unavailable };
}

/** The single biggest absolute move today, for the agent preview line. Null when no data. */
export function biggestMove(
  quotes: Record<string, Quote>,
  instruments: Instrument[],
): MoverRow | null {
  const all = [...movers(quotes, instruments).gainers, ...movers(quotes, instruments).losers];
  if (all.length === 0) return null;
  return all.reduce((best, r) => (Math.abs(r.changePct) > Math.abs(best.changePct) ? r : best));
}
