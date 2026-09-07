export type MarketSession = 'open' | 'closed' | 'pre' | 'post' | 'unknown';

// NYSE holiday closings for 2026 (dates in America/New_York).
const NYSE_HOLIDAYS_2026 = new Set([
  '2026-01-01', // New Year's Day
  '2026-01-19', // Martin Luther King, Jr. Day
  '2026-02-16', // Presidents' Day
  '2026-04-03', // Good Friday
  '2026-05-25', // Memorial Day
  '2026-06-19', // Juneteenth National Independence Day
  '2026-07-03', // Independence Day (observed)
  '2026-09-07', // Labor Day
  '2026-11-26', // Thanksgiving Day
  '2026-12-25', // Christmas Day
]);

// ponytail: static 2026 table; add an exchange-calendar feed if the app outlives 2026.
const etParts = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  weekday: 'short',
  hour12: false,
});

/** Session in America/New_York, DST-correct via Intl — never local getDay(). */
export function sessionFor(now: Date): MarketSession {
  const p = new Map(etParts.formatToParts(now).map((x) => [x.type, x.value]));
  const date = `${p.get('year')}-${p.get('month')}-${p.get('day')}`;
  const weekday = p.get('weekday') ?? '';
  if (weekday === 'Sat' || weekday === 'Sun') return 'closed';
  if (NYSE_HOLIDAYS_2026.has(date)) return 'closed';
  const hour = Number(p.get('hour')) % 24; // hour12:false can yield "24"
  const minutes = hour * 60 + Number(p.get('minute'));
  if (minutes >= 9 * 60 + 30 && minutes < 16 * 60) return 'open';
  if (minutes >= 4 * 60 && minutes < 9 * 60 + 30) return 'pre';
  if (minutes >= 16 * 60 && minutes < 20 * 60) return 'post';
  return 'closed';
}
