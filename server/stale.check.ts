// One runnable check for the stale axis (orthogonal to session/mode/connected).
// Run: npm run check:stale
import { computeStale } from './store.js';

const now = Date.now();
const old = now - 91_000; // past the 90s threshold
const fresh = now - 89_000;

const cases: Array<[lastSeen: number, transport: 'live' | 'poll' | 'none', session: 'open' | 'closed' | 'pre', expect: boolean, label: string]> = [
  [old, 'live', 'open', true, 'live + open + 91s old → stale'],
  [fresh, 'live', 'open', false, 'live + open + 89s old → fresh'],
  [old, 'poll', 'open', false, 'poll transport never flags stale (snapshot semantics)'],
  [old, 'none', 'open', false, 'no transport never flags stale'],
  [old, 'live', 'closed', false, 'closed session never flags stale (quiet, not stale)'],
  [old, 'live', 'pre', false, 'pre-market never flags stale'],
  [old, 'live', 'open', true, 'mode is not an input — a snapshot-mode quote goes stale the same way'],
];

let failed = 0;
for (const [lastSeen, transport, session, expect, label] of cases) {
  const got = computeStale(lastSeen, transport, session, now);
  const ok = got === expect;
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(30)} expect=${expect} got=${got}`);
}
if (failed > 0) {
  console.error(`\n${failed} failure(s)`);
  process.exit(1);
}
console.log('\nall stale-axis checks passed');
