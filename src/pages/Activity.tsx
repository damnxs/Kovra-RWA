import { useMemo } from 'react';
import { ActivitySummary } from '../components/activity/ActivitySummary';
import { ChainFeed } from '../components/activity/ChainFeed';
import { PulseChart } from '../components/activity/PulseChart';
import { summarizeWindow } from '../components/activity/feedModel';
import { useOnchainFeed } from '../data/OnchainProvider';

/**
 * Realtime activity: the whole market's pulse on Robinhood Chain in one calm
 * screen. Every row is a real event streamed from the Kovra server's own
 * chain connection, and the summary only ever describes the live window this
 * page holds, never a full trading day.
 */
export function Activity() {
  const { log, block, connected } = useOnchainFeed();
  const summary = useMemo(() => summarizeWindow(log), [log]);

  return (
    <div className="fade-in mx-auto max-w-content px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
      <p className="eyebrow">Realtime activity</p>
      <h1 className="mt-3 font-serif font-light text-[36px] leading-tight sm:text-[44px]">
        Every event, the moment it settles.
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
        Every trade, liquidity move and block on Robinhood Chain, streamed the moment it confirms
        and linked to its transaction on the explorer. Nothing curated, nothing delayed.
      </p>

      <ActivitySummary
        className="mt-6"
        transferVolumeUsd={summary.transferVolumeUsd}
        transfers={summary.transfers}
        swaps={summary.swaps}
        block={block}
        connected={connected}
      />
      <PulseChart className="mt-4" log={log} />
      <ChainFeed className="mt-4" />
    </div>
  );
}
