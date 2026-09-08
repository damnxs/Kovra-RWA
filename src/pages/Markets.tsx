import { MarketDiscovery } from '../components/MarketDiscovery';
import { StatusStrip } from '../components/StatusStrip';

/**
 * /markets: every tracked Uniswap pool on Robinhood Chain in one quiet table.
 * The page shell owns the editorial heading; MarketDiscovery owns the data.
 */
export function Markets() {
  return (
    <div className="fade-in mx-auto max-w-content px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Markets</p>
          <h1 className="mt-3 font-serif font-light text-[36px] leading-tight sm:text-[44px]">
            The onchain tape.
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Every token Kovra tracks trades in a real Uniswap pool on Robinhood Chain. Prices are
            struck by live swaps, pool value is the live balance of both sides, and every trade is
            counted the moment it confirms.
          </p>
        </div>
        <StatusStrip refresh={false} />
      </div>
      <div className="mt-8">
        <MarketDiscovery />
      </div>
    </div>
  );
}
