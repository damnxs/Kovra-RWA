// One runnable check for session math (ET via Intl, DST, weekends, 2026 holidays).
// Run: npm run check:session
import { sessionFor } from './session.js';

const cases: Array<[iso: string, expect: string, label: string]> = [
  ['2026-09-07T15:00:00Z', 'closed', 'Labor Day 11:00 ET'],
  ['2026-09-08T15:00:00Z', 'open', 'Tue 11:00 ET'],
  ['2026-09-08T13:00:00Z', 'pre', 'Tue 09:00 ET'],
  ['2026-09-08T13:29:00Z', 'pre', 'Tue 09:29 ET'],
  ['2026-09-08T13:30:00Z', 'open', 'Tue 09:30 ET sharp'],
  ['2026-09-08T20:59:00Z', 'post', 'Tue 16:59 ET'],
  ['2026-09-08T21:00:00Z', 'post', 'Tue 17:00 ET (post market)'],
  ['2026-09-08T01:00:00Z', 'closed', 'Tue 21:00 ET'],
  ['2026-09-12T15:00:00Z', 'closed', 'Sat 11:00 ET'],
  ['2026-09-13T15:00:00Z', 'closed', 'Sun 11:00 ET'],
  ['2026-06-01T15:00:00Z', 'open', 'summer 11:00 ET (DST)'],
  ['2026-01-05T15:00:00Z', 'open', 'winter 10:00 ET (no DST)'],
  ['2026-01-05T14:30:00Z', 'open', 'winter 09:30 ET (DST shift proof)'],
  ['2026-01-05T14:29:00Z', 'pre', 'winter 09:29 ET (DST shift proof)'],
  ['2026-12-25T15:00:00Z', 'closed', 'Christmas 10:00 ET'],
];

let failed = 0;
for (const [iso, expect, label] of cases) {
  const got = sessionFor(new Date(iso));
  const ok = got === expect;
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(30)} expect=${expect} got=${got}`);
}
if (failed > 0) {
  console.error(`\n${failed} failure(s)`);
  process.exit(1);
}
console.log('\nall session checks passed');
