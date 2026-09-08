import { useMemo } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ChainLogEntry } from '../../types/quote';
import { formatTime } from '../../lib/format';

/**
 * The chain's heartbeat for the Activity page: real swaps and token transfers
 * bucketed per second over the last minute, stacked so a spike reads as what
 * it is (trading vs token movement). Flat stretches are honest, they mean
 * those seconds were genuinely quiet.
 */

const BUCKET_MS = 1_000;
const MAX_BUCKETS = 60;

export function PulseChart({ log, className = '' }: { log: ChainLogEntry[]; className?: string }) {
  // Buckets are anchored to the newest event, not Date.now(): pure per render,
  // and the ring ticks constantly anyway (block headers stream in continuously).
  const data = useMemo(() => {
    let newest = 0;
    for (const e of log) {
      const t = Date.parse(e.at);
      if (t > newest) newest = t;
    }
    if (newest === 0) return [] as Array<{ t: number; trades: number; transfers: number }>;
    const now = Math.floor(newest / BUCKET_MS) * BUCKET_MS;
    const counts = new Map<number, { trades: number; transfers: number }>();
    let oldest = now;
    for (const e of log) {
      if (e.kind !== 'swap' && e.kind !== 'transfer') continue; // market events only
      const b = Math.floor(Date.parse(e.at) / BUCKET_MS) * BUCKET_MS;
      if (b > now) continue; // clock skew guard
      const c = counts.get(b) ?? { trades: 0, transfers: 0 };
      if (e.kind === 'swap') c.trades++;
      else c.transfers++;
      counts.set(b, c);
      if (b < oldest) oldest = b;
    }
    const start = Math.max(oldest, now - (MAX_BUCKETS - 1) * BUCKET_MS);
    const out: Array<{ t: number; trades: number; transfers: number }> = [];
    for (let b = start; b <= now; b += BUCKET_MS) {
      const c = counts.get(b);
      out.push({ t: b, trades: c?.trades ?? 0, transfers: c?.transfers ?? 0 });
    }
    return out;
  }, [log]);

  return (
    <section
      aria-label="Chain pulse chart"
      className={`rounded-panel border border-line bg-surface ${className}`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <div>
          <p className="eyebrow">Chain pulse</p>
          <p className="mt-0.5 text-xs text-muted">real trades and transfers</p>
        </div>
        <div className="flex shrink-0 items-center gap-4 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2 w-2 rounded-xs bg-accent" />
            Trades
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2 w-2 rounded-xs bg-muted/55" />
            Transfers
          </span>
        </div>
      </div>
      <div className="h-32 p-2 sm:h-36">
        {data.length === 0 ? (
          <p className="flex h-full items-center justify-center text-xs text-muted">
            The pulse starts with the first event.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }} barCategoryGap="15%">
              <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} hide />
              <YAxis hide domain={[0, 'auto']} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: 'rgba(20, 23, 19, 0.04)' }}
                labelFormatter={(t: number) => formatTime(new Date(t).toISOString())}
                formatter={(v: number | string, name: string) => [
                  String(v),
                  name === 'trades' ? 'Trades' : 'Transfers',
                ]}
                contentStyle={{ borderRadius: 6, border: '1px solid #e2e6dc', fontSize: 12 }}
              />
              {/* No bar animation: the window re-buckets on every log tick
                  (~4/s with block headers), so animated bars would never stop
                  restarting and the chart looks like it is crawling. */}
              <Bar dataKey="trades" stackId="pulse" fill="#ccff00" isAnimationActive={false} />
              <Bar
                dataKey="transfers"
                stackId="pulse"
                fill="#62685e"
                fillOpacity={0.55}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
