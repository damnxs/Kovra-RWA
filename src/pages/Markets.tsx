import { MarketDiscovery } from '../components/MarketDiscovery';

export function Markets() {
  return (
    <div className="mx-auto max-w-content px-5 py-12 sm:px-8 sm:py-16 lg:px-12">
      <p className="eyebrow">Markets</p>
      <div className="mt-3">
        <MarketDiscovery heading="All markets" headingLevel="h1" />
      </div>
    </div>
  );
}
