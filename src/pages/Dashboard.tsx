import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pie, PieChart, Cell, ResponsiveContainer } from 'recharts';
import { useWallet, chainName, shortAddress } from '../data/WalletProvider';
import { useMarket } from '../data/MarketProvider';
import { useOnchainBalances, useOnchainFeed } from '../data/OnchainProvider';
import { biggestMove } from '../lib/agent';
import { Chip } from '../components/Chip';
import { ConnectWalletButton } from '../components/ConnectWalletButton';
import { RefreshStatus } from '../components/RefreshStatus';
import { formatPct } from '../lib/format';

/**
 * Portofolio — high-level account overview (dashboard-style.md).
 * Holdings are real: ERC-20 balances read live from Robinhood Chain for the
 * connected wallet, valued at the live onchain pool prices. Nothing here is
 * estimated — an empty wallet renders an honest empty state, never a
 * fabricated portfolio.
 */
type Holding = {
  instrumentId: string;
  name: string;
  category: string;
  valueUsd: number;
  periodChangePct: number | null;
};

const MIX_NEUTRALS = ['#141713', '#62685e', '#a9aea4', '#c9cdc2', '#dfe3d8'];

export function Dashboard() {
  const {
    address,
    chainId,
    connecting,
    disconnect,
    error,
    hasProvider,
    onRobinhoodChain,
    switchToRobinhoodChain,
  } = useWallet();
  const { instruments, quotes } = useMarket();
  const balances = useOnchainBalances(address);
  const { connected: chainConnected } = useOnchainFeed();
  const [copied, setCopied] = useState(false);

  const { holdings, loadingHoldings } = useMemo(() => {
    if (!balances.data) return { holdings: [] as Holding[], loadingHoldings: balances.loading };
    const byId = new Map(instruments.map((i) => [i.id, i]));
    const rows: Holding[] = [];
    if (balances.data.eth > 0 && balances.data.ethValueUsd !== null) {
      rows.push({
        instrumentId: 'eth',
        name: 'ETH (native gas)',
        category: 'Crypto',
        valueUsd: balances.data.ethValueUsd,
        periodChangePct: quotes['weth']?.changePct ?? null,
      });
    }
    for (const b of balances.data.balances) {
      if (b.amount <= 0 || b.valueUsd === null) continue;
      rows.push({
        instrumentId: b.instrumentId,
        name: b.symbol,
        category: byId.get(b.instrumentId)?.category ?? 'Onchain',
        valueUsd: b.valueUsd,
        periodChangePct: quotes[b.instrumentId]?.changePct ?? null,
      });
    }
    return { holdings: rows.sort((a, b) => b.valueUsd - a.valueUsd), loadingHoldings: false };
  }, [balances.data, balances.loading, instruments, quotes]);

  if (connecting) {
    return (
      <div className="fade-in mx-auto max-w-content px-5 py-16 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-xl rounded-panel border border-line bg-surface px-5 py-10 text-center">
          <span
            aria-hidden="true"
            className="mx-auto block h-6 w-6 animate-spin rounded-full border-2 border-line border-t-ink"
          />
          <p className="mt-4 font-medium">Connecting wallet…</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Confirm the request in your wallet. Your dashboard opens the moment the connection
            completes.
          </p>
        </div>
      </div>
    );
  }

  if (!address) {
    return (
      <div className="fade-in mx-auto max-w-content px-5 py-16 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-xl">
          <StatePanelConnect error={error} hasProvider={hasProvider} />
        </div>
      </div>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — the full address is visible below anyway */
    }
  };

  const total = holdings.reduce((s, h) => s + h.valueUsd, 0);
  const mix = holdings.map((h, i) => ({
    name: h.category,
    value: h.valueUsd,
    // One highlighted segment (largest) in lime; the rest neutral.
    color: i === 0 ? '#ccff00' : MIX_NEUTRALS[i % MIX_NEUTRALS.length]!,
  }));
  const move = biggestMove(quotes, instruments);

  return (
    <div className="fade-in mx-auto max-w-content px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Connected account</p>
          <h1 className="mt-3 font-serif text-[36px] leading-tight sm:text-[44px]">Portofolio.</h1>
        </div>
        <RefreshStatus />
      </div>

      {/* Identity and network — accurate, never a hardcoded "connected" claim. */}
      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line pt-4 text-sm">
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-positive" />
          <span className="tabular-nums font-medium">{shortAddress(address)}</span>
          <button
            type="button"
            onClick={copy}
            className="rounded-control border border-line bg-surface px-2 py-1 text-xs font-medium transition-colors hover:border-ink"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            type="button"
            onClick={disconnect}
            className="rounded-control border border-line bg-surface px-2 py-1 text-xs font-medium text-muted transition-colors hover:border-ink hover:text-ink"
          >
            Disconnect
          </button>
        </span>
        <span className="text-muted">
          Network:{' '}
          <span className="font-medium text-ink">{chainName(chainId)}</span>{' '}
          {onRobinhoodChain ? (
            <Chip tone="positive">Robinhood Chain connected</Chip>
          ) : (
            <>
              <Chip tone="warn">Not on Robinhood Chain</Chip>{' '}
              <button
                type="button"
                onClick={() => void switchToRobinhoodChain()}
                className="rounded-control border border-line bg-surface px-2 py-1 text-xs font-medium transition-colors hover:border-ink"
              >
                Switch network
              </button>
            </>
          )}
          {chainConnected === false && <Chip tone="warn">Chain feed offline</Chip>}
        </span>
      </div>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
        Holdings below are real balances of supported tokens, read live from Robinhood Chain
        (chainId 4663) and valued at current onchain pool prices. Values refresh about once a
        minute. Nothing can be bought, sold, or transferred through Kovra — this is a read-only
        view of your wallet.
      </p>

      {/* Summary: with no supported holdings we do not render a fabricated $0 portfolio. */}
      {holdings.length === 0 ? (
        <div className="mt-8 rounded-panel border border-line bg-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-medium">
              {loadingHoldings ? 'Reading balances on Robinhood Chain…' : 'No supported holdings detected'}
            </h2>
            <Chip>Verified exposure only</Chip>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            {balances.error === 'chain-unavailable'
              ? 'Robinhood Chain could not be reached for this wallet — balances will appear when the connection recovers.'
              : loadingHoldings
                ? 'Fetching real ERC-20 balances for this wallet from Robinhood Chain.'
                : 'Kovra shows exposure only from verified onchain balances of supported assets — this wallet holds none of them yet. Kovra also tracks ' +
                  instruments.length +
                  ' reference instruments for discovery; watching them is not ownership.'}
          </p>
          <Link
            to="/markets"
            className="mt-4 inline-flex h-11 items-center rounded-control bg-ink px-4 text-sm font-medium text-white transition-opacity hover:opacity-85"
          >
            Explore markets
          </Link>
        </div>
      ) : (
        <dl className="mt-8 grid border-t border-line pt-4 sm:grid-cols-3 sm:gap-8">
          <div>
            <dt className="text-xs text-muted">Total exposure (verified)</dt>
            <dd className="mt-1 font-serif text-3xl tabular-nums">
              ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Period change</dt>
            <dd className="mt-1 font-serif text-3xl tabular-nums">Today</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Assets tracked</dt>
            <dd className="mt-1 font-serif text-3xl tabular-nums">{holdings.length}</dd>
          </div>
        </dl>
      )}

      {/* Main exposure area: 65/35 on desktop, stacked below. */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[65fr_35fr]">
        <section aria-labelledby="exposure-heading" className="rounded-panel border border-line bg-surface p-5">
          <h2 id="exposure-heading" className="font-medium">
            Your market exposure
          </h2>
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th scope="col" className="py-2 font-medium">Asset / exposure</th>
                <th scope="col" className="py-2 font-medium">Category</th>
                <th scope="col" className="py-2 text-right font-medium">Allocation</th>
                <th scope="col" className="hidden py-2 text-right font-medium sm:table-cell">Value</th>
                <th scope="col" className="py-2 text-right font-medium">Today</th>
              </tr>
            </thead>
            <tbody>
              {holdings.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted">
                    {loadingHoldings
                      ? 'Reading verified balances from Robinhood Chain…'
                      : 'No supported holdings — allocation appears once verified balances are detected.'}
                  </td>
                </tr>
              ) : (
                holdings.map((h) => (
                  <tr key={h.instrumentId} className="border-b border-line last:border-b-0">
                    <td className="py-3">
                      {h.instrumentId === 'eth' ? (
                        <span className="font-medium">{h.name}</span>
                      ) : (
                        <Link to={`/markets/${h.instrumentId}`} className="font-medium hover:underline">
                          {h.name}
                        </Link>
                      )}
                    </td>
                    <td className="py-3 text-muted">{h.category}</td>
                    <td className="py-3 text-right tabular-nums">
                      {total > 0 ? `${Math.round((h.valueUsd / total) * 100)}%` : '—'}
                    </td>
                    <td className="hidden py-3 text-right tabular-nums sm:table-cell">
                      ${h.valueUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 text-right tabular-nums">
                      {formatPct(h.periodChangePct) ?? '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <div className="space-y-4">
          <section aria-labelledby="mix-heading" className="rounded-panel border border-line bg-surface p-5">
            <h2 id="mix-heading" className="font-medium">
              Exposure mix
            </h2>
            {mix.length === 0 ? (
              <div className="mt-4 flex h-[180px] flex-col items-center justify-center rounded-panel border border-dashed border-line text-center">
                <p className="text-sm text-muted">Mix chart builds from verified holdings.</p>
                <p className="mt-1 max-w-[220px] text-xs text-muted">
                  Generated from the same values as the allocation table — never estimated.
                </p>
              </div>
            ) : (
              <div className="mt-4 h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={mix} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" stroke="none" isAnimationActive={false}>
                      {mix.map((m) => (
                        <Cell key={m.name} fill={m.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                  {mix.map((m) => (
                    <li key={m.name} className="flex items-center gap-1.5">
                      <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: m.color }} />
                      {m.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section aria-labelledby="agent-heading" className="rounded-panel border border-line bg-surface p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 id="agent-heading" className="font-medium">
                Kovra Agent
              </h2>
              <Chip>Preview</Chip>
            </div>
            <ul className="mt-3 space-y-3 text-sm">
              <li>
                <p className="font-medium">Concentration</p>
                <p className="mt-0.5 leading-relaxed text-muted">
                  {holdings.length > 0
                    ? `Largest position is ${total > 0 ? Math.round((holdings[0]!.valueUsd / total) * 100) : 0}% of verified exposure (${holdings[0]!.name}). Computed from onchain balances only — watchlists are never read as owned exposure.`
                    : 'No supported holdings to analyze. Concentration is computed from verified onchain balances only — watchlists are never read as owned exposure.'}
                </p>
              </li>
              <li>
                <p className="font-medium">Overlap</p>
                <p className="mt-0.5 leading-relaxed text-muted">
                  {holdings.length >= 2
                    ? `${holdings.length} supported holdings detected — overlap analysis across categories arrives with the full agent.`
                    : 'Overlap detection needs at least two supported holdings; none are connected.'}
                </p>
              </li>
              <li>
                <p className="font-medium">Market context</p>
                <p className="mt-0.5 leading-relaxed text-muted">
                  {move
                    ? `Largest tracked move today: ${move.instrument.symbol} ${formatPct(move.changePct)} within Kovra's ${instruments.length} tracked reference instruments.`
                    : 'Market context appears once quote data is available.'}
                </p>
              </li>
            </ul>
            <Link
              to="/agent"
              className="mt-4 inline-flex h-11 items-center rounded-control border border-line bg-surface px-4 text-sm font-medium transition-colors hover:border-ink"
            >
              Open Agent <span aria-hidden="true">&nbsp;→</span>
            </Link>
          </section>
        </div>
      </div>

      {/* Short links only — the full watchlist and activity live on their own routes. */}
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          to="/watchlist"
          className="inline-flex h-11 items-center rounded-control border border-line bg-surface px-4 text-sm font-medium transition-colors hover:border-ink"
        >
          View watchlist <span aria-hidden="true">&nbsp;→</span>
        </Link>
        <Link
          to="/activity"
          className="inline-flex h-11 items-center rounded-control border border-line bg-surface px-4 text-sm font-medium transition-colors hover:border-ink"
        >
          View activity <span aria-hidden="true">&nbsp;→</span>
        </Link>
      </div>
    </div>
  );
}

function StatePanelConnect({ error, hasProvider }: { error: string | null; hasProvider: boolean }) {
  return (
    <div className="rounded-panel border border-line bg-surface px-5 py-5">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-line" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">Connect a wallet to open your dashboard</p>
          <div className="mt-1 text-sm leading-relaxed text-muted">
            Connecting shows your real token balances on Robinhood Chain. Kovra holds no keys,
            signs nothing, and cannot move funds — this is a read-only view.
          </div>
        </div>
        <div className="shrink-0">
          <ConnectWalletButton navigateOnConnect={false} />
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-negative">
          {error}
        </p>
      )}
      {!hasProvider && (
        <p className="mt-3 text-sm text-muted">
          No wallet was detected in this browser. Install an EVM wallet such as MetaMask, or open
          Kovra in your wallet&rsquo;s built-in browser.
        </p>
      )}
      <p className="mt-6 text-sm text-muted">
        Just exploring?{' '}
        <Link to="/markets" className="font-medium text-ink underline underline-offset-4">
          Browse markets
        </Link>{' '}
        — no wallet needed.
      </p>
    </div>
  );
}
