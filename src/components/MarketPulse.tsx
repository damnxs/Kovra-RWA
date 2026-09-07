import { useMarket } from '../data/MarketProvider';
import { formatPrice, formatTime, formatAgo, SESSION_LABEL } from '../lib/format';
import { PriceCell } from './PriceCell';
import { ChangeLabel } from './ChangeLabel';
import { Chip } from './Chip';
import { StatusStrip } from './StatusStrip';
import { StatePanel, SkeletonRows } from './StatePanel';

/** One tape entry — symbol · price · signed change. Compact enough to repeat. */
function TapeItem({
  inst,
  q,
}: {
  inst: { id: string; symbol: string; type: 'etf' | 'token' };
  q: ReturnType<typeof useMarket>['quotes'][string] | undefined;
}) {
  return (
    <span className="flex items-center gap-2.5 px-4 py-3 text-sm whitespace-nowrap">
      <span aria-hidden="true" className="text-muted/40">
        ◆
      </span>
      <span className="font-semibold">{inst.symbol}</span>
      {inst.type === 'token' && (
        <span className="text-[10px] tracking-wide text-muted uppercase">onchain</span>
      )}
      {q ? (
        <>
          <PriceCell price={formatPrice(q.price)} className="font-medium" />
          <ChangeLabel pct={q.changePct} />
          {q.stale && <span className="text-[10px] tracking-wide text-muted uppercase">stale</span>}
        </>
      ) : (
        <span className="text-muted">awaiting first observation</span>
      )}
    </span>
  );
}

/**
 * Market pulse as a ticker tape: every instrument on one continuous strip that
 * scrolls left. The list is rendered twice (second copy aria-hidden) and the
 * track translates -50% for a seamless loop; hover/focus pauses it, and
 * prefers-reduced-motion degrades to a plain scrollable strip (copy hidden).
 */
export function MarketPulse() {
  const { instruments, quotes, status, conn } = useMarket();

  const loading = !status && Object.keys(quotes).length === 0 && conn === 'connecting';

  // Honest stamps kept in the header (per-item details don't survive a moving tape):
  // the newest observation time across quotes, and the equity session from ETFs.
  const quoted = instruments.map((i) => quotes[i.id]).filter(Boolean);
  const newest = quoted.reduce<string | null>(
    (max, q) => (!max || q!.receivedAt > max ? q!.receivedAt : max),
    null,
  );
  const firstEtf = instruments.find((i) => i.type === 'etf');
  const etfSession = firstEtf ? (SESSION_LABEL[quotes[firstEtf.id]?.session ?? ''] ?? null) : null;

  return (
    <section aria-label="Market pulse" className="border-b border-line bg-surface">
      <div className="mx-auto max-w-content px-5 pt-8 sm:px-8 lg:px-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium">Market pulse</h2>
          <div className="flex flex-wrap items-center gap-2">
            {etfSession && <Chip>{etfSession}</Chip>}
            {newest && (
              <span className="text-xs text-muted tabular-nums">
                as of {formatTime(newest)} · {formatAgo(newest)}
              </span>
            )}
            <StatusStrip />
          </div>
        </div>
      </div>

      <div className="mt-4">
        {status?.missingKey ? (
          <div className="mx-auto max-w-content px-5 pb-8 sm:px-8 lg:px-12">
            <StatePanel title="Market data is unavailable">
              The market data service is not configured right now. Instruments and categories remain
              available to browse — please check back later.
            </StatePanel>
          </div>
        ) : loading ? (
          <div className="mx-auto max-w-content px-5 pb-8 sm:px-8 lg:px-12">
            <p className="text-sm text-muted" role="status">
              Loading market data…
            </p>
            <div className="mt-3">
              <SkeletonRows rows={2} />
            </div>
          </div>
        ) : (
          <div className="ticker relative overflow-hidden border-y border-line">
            <div
              className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-surface to-transparent"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-surface to-transparent"
              aria-hidden="true"
            />
            <div
              className="ticker-track flex w-max"
              style={{ '--ticker-duration': `${Math.max(40, instruments.length * 4)}s` } as React.CSSProperties}
            >
              <ul className="flex items-center" aria-label="Tracked instruments">
                {instruments.map((inst) => (
                  <li key={inst.id}>
                    <TapeItem inst={inst} q={quotes[inst.id]} />
                  </li>
                ))}
              </ul>
              <ul className="ticker-copy flex items-center" aria-hidden="true">
                {instruments.map((inst) => (
                  <li key={inst.id}>
                    <TapeItem inst={inst} q={quotes[inst.id]} />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
