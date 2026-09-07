import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useWallet, chainName } from '../data/WalletProvider';
import { useMarket } from '../data/MarketProvider';
import { ConnectWalletButton } from '../components/ConnectWalletButton';
import { Chip } from '../components/Chip';
import { RefreshStatus } from '../components/RefreshStatus';
import { formatPrice } from '../lib/format';

/**
 * Trade — swap-style order preview between the target chain's native asset
 * (RobinCrow, RBNC) and the selected instrument. Wallet-gated: connect first,
 * then the calculator runs on the live quote. For onchain tokens the price is
 * the real Uniswap pool price on Robinhood Chain; for ETF proxies it is the
 * reference market price. Execution remains a labeled preview — no transaction
 * is ever signed or sent.
 */

// ponytail: placeholder 1:1 USD reference rate until a real RBNC oracle exists.
const RBNC_USD = 1;

const fmtUnits = (n: number) =>
  n.toLocaleString('en-US', { maximumFractionDigits: n !== 0 && n < 1 ? 6 : 4 });

export function Trade() {
  const { id = '' } = useParams();
  const { address, connecting, error, hasProvider, chainId, onRobinhoodChain, switchToRobinhoodChain } = useWallet();
  const { instruments, quotes } = useMarket();
  const [dir, setDir] = useState<'buy' | 'sell'>('buy'); // buy: pay RBNC → receive asset
  const [amount, setAmount] = useState('100');
  const [filled, setFilled] = useState<null | { pay: string; receive: string }>(null);

  const instrument = instruments.find((i) => i.id === id);
  const quote = quotes[id];
  const price = quote ? Number(quote.price) : null;

  if (connecting) {
    return (
      <div className="fade-in mx-auto max-w-content px-5 py-16 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-xl rounded-panel border border-line bg-surface px-5 py-10 text-center">
          <span
            aria-hidden="true"
            className="mx-auto block h-6 w-6 animate-spin rounded-full border-2 border-line border-t-ink"
          />
          <p className="mt-4 font-medium">Connecting wallet…</p>
        </div>
      </div>
    );
  }

  if (!instrument) {
    return (
      <div className="fade-in mx-auto max-w-content px-5 py-16 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-xl rounded-panel border border-line bg-surface p-5">
          <h1 className="font-medium">Instrument not found</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            This trade link points to an instrument Kovra does not track.
          </p>
          <Link
            to="/markets"
            className="mt-4 inline-flex h-11 items-center rounded-control bg-ink px-4 text-sm font-medium text-white transition-opacity hover:opacity-85"
          >
            Back to markets
          </Link>
        </div>
      </div>
    );
  }

  const sym = instrument.symbol;

  if (!address) {
    return (
      <div className="fade-in mx-auto max-w-content px-5 py-16 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-xl rounded-panel border border-line bg-surface px-5 py-5">
          <p className="eyebrow">Trade {sym}</p>
          <div className="mt-3 flex items-start gap-3">
            <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-line" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">Connect a wallet to trade {sym}</p>
              <div className="mt-1 text-sm leading-relaxed text-muted">
                The order calculator opens as soon as your wallet is connected. Kovra holds no keys
                and signs nothing.
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
        </div>
      </div>
    );
  }

  const paySym = dir === 'buy' ? 'RBNC' : sym;
  const receiveSym = dir === 'buy' ? sym : 'RBNC';
  const onchain = instrument.type === 'token';
  const n = Number(amount);
  const valid = Number.isFinite(n) && n > 0 && price !== null && price > 0;
  // Both legs priced in USD: RBNC via its reference rate, the asset via the live quote.
  const payUsd = dir === 'buy' ? n * RBNC_USD : n * (price ?? 0);
  const receive = valid ? payUsd / (dir === 'buy' ? price : RBNC_USD) : null;
  const rate = price !== null && price > 0 ? (dir === 'buy' ? price / RBNC_USD : RBNC_USD / price) : null; // receive units per 1 pay unit

  return (
    <div className="fade-in mx-auto max-w-content px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
      <div className="mx-auto max-w-xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Trade</p>
            <h1 className="mt-3 font-serif text-[36px] leading-tight sm:text-[44px]">
              {sym}
              <span className="ml-2 align-middle font-sans text-sm font-normal text-muted">
                {instrument.name}
              </span>
            </h1>
          </div>
          <RefreshStatus />
        </div>

        <div className="mt-6 rounded-panel border border-line bg-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Chip tone={dir === 'buy' ? 'positive' : 'accent'}>
                {dir === 'buy' ? `Buy ${sym}` : `Sell ${sym}`}
              </Chip>
              <Chip tone="warn">Preview — execution pending</Chip>
            </div>
            <button
              type="button"
              onClick={() => {
                setDir((d) => (d === 'buy' ? 'sell' : 'buy'));
                setFilled(null);
              }}
              className="flex h-11 items-center gap-2 rounded-control border border-line px-4 text-sm font-medium transition-colors hover:border-ink"
              aria-label={`Switch to ${dir === 'buy' ? `selling ${sym} for RBNC` : `buying ${sym} with RBNC`}`}
            >
              <span aria-hidden="true">⇅</span> Switch
            </button>
          </div>

          {/* Pay side */}
          <div className="mt-4 rounded-panel border border-line bg-page p-4">
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor="trade-amount" className="text-xs font-medium text-muted">
                You pay
              </label>
              <span className="text-xs text-muted tabular-nums">
                {paySym === 'RBNC'
                  ? `1 RBNC = $${RBNC_USD.toLocaleString('en-US')} reference rate`
                  : price !== null
                    ? `1 ${sym} = ${formatPrice(quote!.price)} ${quote!.currency}${onchain ? ' · onchain pool price' : ''}`
                    : 'Awaiting price…'}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <input
                id="trade-amount"
                inputMode="decimal"
                autoComplete="off"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value.replace(/[^\d.]/g, ''));
                  setFilled(null);
                }}
                className="min-w-0 flex-1 bg-transparent font-serif text-3xl tabular-nums outline-none"
                placeholder="0"
              />
              <span className="shrink-0 rounded-control border border-line bg-surface px-3 py-1.5 text-sm font-medium">
                {paySym}
              </span>
            </div>
          </div>

          {/* Receive side */}
          <div className="mt-3 rounded-panel border border-line bg-page p-4">
            <p className="text-xs font-medium text-muted">You receive (estimated)</p>
            <div className="mt-2 flex items-center gap-3">
              <p className="min-w-0 flex-1 truncate font-serif text-3xl tabular-nums">
                {receive === null ? '—' : fmtUnits(receive)}
              </p>
              <span className="shrink-0 rounded-control border border-line bg-surface px-3 py-1.5 text-sm font-medium">
                {receiveSym}
              </span>
            </div>
            {rate !== null && (
              <p className="mt-1.5 text-xs text-muted tabular-nums">
                Rate: 1 {paySym} = {fmtUnits(rate)} {receiveSym}
              </p>
            )}
          </div>

          <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-muted">Order value</dt>
              <dd className="tabular-nums">
                {valid ? `$${payUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : '—'}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-muted">{sym} price used</dt>
              <dd className="tabular-nums">
                {price !== null ? formatPrice(quote!.price) : '—'}
                {onchain && price !== null && <span className="text-muted"> · Uniswap pool</span>}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-muted">Network</dt>
              <dd className="flex flex-wrap items-center justify-end gap-1.5">
                <span>{chainName(chainId)}</span>
                {onRobinhoodChain ? (
                  <Chip tone="positive">Robinhood Chain</Chip>
                ) : (
                  <>
                    <Chip tone="warn">Not on Robinhood Chain</Chip>
                    <button
                      type="button"
                      onClick={() => void switchToRobinhoodChain()}
                      className="rounded-control border border-line bg-surface px-2 py-1 text-xs font-medium transition-colors hover:border-ink"
                    >
                      Switch
                    </button>
                  </>
                )}
              </dd>
            </div>
          </dl>

          {filled ? (
            <div className="mt-4 rounded-panel border border-line bg-accent-soft/60 p-4" role="status">
              <p className="font-medium">Preview order recorded</p>
              <p className="mt-1 text-sm leading-relaxed text-muted tabular-nums">
                You would pay {fmtUnits(Number(filled.pay))} RBNC for {fmtUnits(Number(filled.receive))} {sym}.
                Nothing executed — orders settle only after verified contracts and routes are live on
                Robinhood Chain.
              </p>
            </div>
          ) : (
            <button
              type="button"
              disabled={!valid}
              onClick={() => valid && receive !== null && setFilled({ pay: amount, receive: String(receive) })}
              className="mt-4 flex h-11 w-full items-center justify-center rounded-control bg-ink text-sm font-medium text-white transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {dir === 'buy' ? `Buy ${sym}` : `Sell ${sym}`}
            </button>
          )}

          <p className="mt-3 text-xs leading-relaxed text-muted">
            {onchain
              ? `${sym} price is the live Uniswap pool price on Robinhood Chain (real onchain market data, refreshed about once a minute). The estimate excludes slippage and fees, and no transaction is signed or sent.`
              : 'Estimated from the current reference price; no contracts, liquidity, or routes are verified yet, so no transaction is signed or sent.'}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            to={`/markets/${instrument.id}`}
            className="inline-flex h-11 items-center rounded-control border border-line bg-surface px-4 text-sm font-medium transition-colors hover:border-ink"
          >
            View {sym} details <span aria-hidden="true">&nbsp;→</span>
          </Link>
          <Link
            to="/markets"
            className="inline-flex h-11 items-center rounded-control border border-line bg-surface px-4 text-sm font-medium transition-colors hover:border-ink"
          >
            Back to markets
          </Link>
        </div>
      </div>
    </div>
  );
}
