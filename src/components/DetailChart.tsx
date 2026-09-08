import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { HistoryPoint } from '../types/quote';
import { formatTime } from '../lib/format';

/**
 * Since-connection series only. Historical candles need a historical feed
 * endpoint and are never called, so nothing here is a full-day history.
 */
export function DetailChart({ points }: { points?: HistoryPoint[] }) {
  const data = (points ?? []).map((p) => ({ t: p.t, p: Number(p.p) }));
  if (data.length < 2) {
    return (
      <div className="flex h-[280px] flex-col items-center justify-center rounded-panel border border-dashed border-line bg-surface text-center">
        <p className="text-sm text-muted">Chart builds as observations arrive.</p>
        <p className="mt-1 max-w-xs text-xs text-muted">
          Full price history is not available yet.
        </p>
      </div>
    );
  }
  return (
    <figure>
      <div className="h-[280px] w-full rounded-panel border border-line bg-surface p-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 12, bottom: 4, left: 4 }}>
            <XAxis
              dataKey="t"
              scale="time"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(t: number) => formatTime(new Date(t).toISOString())}
              stroke="#62685e"
              fontSize={11}
              tickLine={false}
              minTickGap={48}
            />
            <YAxis
              domain={['auto', 'auto']}
              stroke="#62685e"
              fontSize={11}
              tickLine={false}
              width={56}
              tickFormatter={(v: number) => v.toFixed(2)}
            />
            <Tooltip
              labelFormatter={(t: number) => formatTime(new Date(t).toISOString())}
              formatter={(v: number | string) => [Number(v).toFixed(2), 'Price']}
              contentStyle={{
                borderRadius: 6,
                border: '1px solid #e2e6dc',
                fontSize: 12,
              }}
            />
            <Line
              type="monotone"
              dataKey="p"
              stroke="#141713"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-2 text-xs text-muted">
        Prices since you connected (full history is not available yet). {data.length} price points.
      </figcaption>
    </figure>
  );
}
