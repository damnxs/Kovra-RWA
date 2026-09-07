import { Hero } from '../components/Hero';
import { MarketPulse } from '../components/MarketPulse';
import { MarketDiscovery } from '../components/MarketDiscovery';
import { MoversPanel } from '../components/MoversPanel';
import { WatchlistPanel } from '../components/WatchlistPanel';
import { AgentPreview } from '../components/AgentPreview';

export function Home() {
  return (
    <>
      <Hero />
      <MarketPulse />
      <div className="mx-auto max-w-content space-y-20 px-5 py-14 sm:px-8 sm:py-16 lg:px-12">
        <MarketDiscovery />
        <section id="insights" aria-label="Insights" className="scroll-mt-24">
          <p className="eyebrow">Insights</p>
          <h2 className="mt-3 font-serif text-[32px] leading-tight sm:text-4xl">What the data says</h2>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            <MoversPanel />
            <WatchlistPanel />
            <AgentPreview />
          </div>
        </section>
      </div>
    </>
  );
}
