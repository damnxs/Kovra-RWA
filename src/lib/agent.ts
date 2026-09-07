import type { Instrument, Quote } from '../types/quote';

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
