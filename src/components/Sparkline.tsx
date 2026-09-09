import { Line, LineChart, ResponsiveContainer, YAxis } from 'recharts';
import type { HistoryPoint } from '../types/quote';

/**
 * Since-connection series only, real timestamped observations from server start.
 * Historical candles are premium-only on the free plan, so nothing is invented.
 */
export function Sparkline({ points }: { points?: HistoryPoint[] }) {
  const data = (points ?? []).map((p) => ({ t: p.t, p: Number(p.p) }));
  if (data.length < 2) {
    return (
      <span className="flex h-8 items-center text-xs text-muted" title="Price trend since you connected, builds as prices arrive">
        <span aria-hidden="true">n/a</span>
        <span className="sr-only">Since-connection series not yet available</span>
      </span>
    );
  }
  return (
    <div className="h-8 w-full" role="img" aria-label={`Price trend since you connected, ${data.length} price points`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
          <YAxis domain={['dataMin', 'dataMax']} hide />
          <Line
            type="monotone"
            dataKey="p"
            stroke="#6e6e65"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
