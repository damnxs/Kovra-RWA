import type { ReactNode } from 'react';
import { formatUsdCompact } from '../../lib/format';

/**
 * Summary strip for the live window: transfer volume, event counts, chain
 * head, feed state. Every figure is derived from the events this page
 * actually holds, so the footnote is explicit: live window, never a day.
 */
export function ActivitySummary({
  className = '',
  transferVolumeUsd,
  transfers,
  swaps,
  block,
  connected,
}: {
  className?: string;
  transferVolumeUsd: number;
  transfers: number;
  swaps: number;
  block: number | null;
  connected: boolean | null;
}) {
  const feed =
    connected === true
      ? { dot: 'animate-pulse bg-positive', label: 'Live' }
      : connected === false
        ? { dot: 'bg-negative', label: 'Reconnecting' }
        : { dot: 'bg-line', label: 'Connecting' };

  return (
    <section aria-label="Live window summary" className={`rounded-panel border border-line bg-surface ${className}`}>
      <div className="grid grid-cols-2 gap-x-4 gap-y-4 px-5 py-4 sm:grid-cols-5 sm:gap-y-0">
        <Stat label="Transfer volume" value={formatUsdCompact(transferVolumeUsd)} />
        <Stat label="Transfers" value={transfers.toLocaleString('en-US')} divide />
        <Stat label="Trades" value={swaps.toLocaleString('en-US')} divide />
        <Stat
          label="Head block"
          value={
            block !== null ? (
              block.toLocaleString('en-US')
            ) : (
              <span className="font-normal text-muted">waiting</span>
            )
          }
          divide
        />
        <Stat
          label="Feed"
          value={
            <span className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${feed.dot}`} aria-hidden="true" />
              {feed.label}
            </span>
          }
          divide
        />
      </div>
      <p className="border-t border-line px-5 py-2.5 text-xs leading-relaxed text-muted">
        Live window: roughly the last 120 chain events this page holds, not a full-day total.
      </p>
    </section>
  );
}

function Stat({ label, value, divide = false }: { label: string; value: ReactNode; divide?: boolean }) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 sm:block sm:text-right ${
        divide ? 'sm:border-l sm:border-line sm:pl-5' : ''
      }`}
    >
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 tabular-nums text-sm font-medium sm:text-base">{value}</p>
    </div>
  );
}
