import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { LuArrowRight } from 'react-icons/lu';
import { useWallet, chainName } from '../data/WalletProvider';
import { useMarket } from '../data/MarketProvider';
import { useOnchainBalances } from '../data/OnchainProvider';
import { ConnectWalletButton } from '../components/ConnectWalletButton';
import { Chip } from '../components/Chip';
import { PriceCell } from '../components/PriceCell';
import { ChangeLabel } from '../components/ChangeLabel';
import { formatPrice } from '../lib/format';
import {
  QUOTER_V2,
  SWAP_ROUTER,
  decodeUint,
  encodeAllowance,
  encodeApprove,
  encodeExactInputSingle,
  encodeQuoteExactInputSingle,
  sendTx,
  waitForReceipt,
  walletCall,
} from '../lib/swap';

/**
 * Trade, for real: a Uniswap V3 swap on Robinhood Chain through SwapRouter02.
 * The wallet signs every transaction, Kovra never holds keys. Flow: live quote
 * from QuoterV2, one ERC20 approve when allowance is short, then exactInputSingle
 * with a 0.5% minimum-out guard. Prices and routes come from the server's own
 * pool subscriptions, tx receipts poll through the wallet RPC.
 */

type Route = {
  instrumentId: string;
  symbol: string;
  pool: string;
  fee: number;
  quoteId: string;
  quoteSymbol: string;
  quoteToken: string;
  quoteDecimals: number;
  baseToken: string;
  baseDecimals: number;
};

/** 0.5% slippage guard: the swap still executes at minOut or better. */
const MIN_OUT_NUMERATOR = 995n;
const MIN_OUT_DENOMINATOR = 1000n;
const TX_URL = 'https://rh-scan.com/tx/';

/** Decimal string → base units; null when empty/invalid/over-precise/zero. */
function toUnits(input: string, decimals: number): bigint | null {
  if (!/^\d*\.?\d*$/.test(input) || input === '' || input === '.') return null;
  const [whole, frac = ''] = input.split('.');
  if (frac.length > decimals) return null;
  const units =
    BigInt(whole || '0') * 10n ** BigInt(decimals) + BigInt((frac + '0'.repeat(decimals)).slice(0, decimals));
  return units === 0n ? null : units;
}

const fmtAmt = (u: bigint, decimals: number) =>
  (Number(u) / 10 ** decimals).toLocaleString('en-US', { maximumFractionDigits: 6 });

/** uint24 fee tier → human percent: 100 → 0.01%, 3000 → 0.3%. */
const feePct = (fee: number) => `${fee / 10000}%`;

function userMsg(err: unknown): string {
  const code = (err as { code?: number })?.code;
  if (code === 4001) return 'You declined the transaction in your wallet.';
  if (err instanceof Error && err.message === 'receipt-timeout')
    return 'Confirmation is taking unusually long. Check the transaction on the explorer below.';
  return 'The wallet could not send the transaction.';
}

type Phase = 'form' | 'approving' | 'swapping' | 'done';

export function Trade() {
  const { id = '' } = useParams();
  const { address, connecting, error, hasProvider, chainId, onRobinhoodChain, switchToRobinhoodChain } = useWallet();
  const { instruments, quotes } = useMarket();
  const [dir, setDir] = useState<'buy' | 'sell'>('buy'); // buy: pay quote token → receive asset
  const [amount, setAmount] = useState('100');
  const [route, setRoute] = useState<Route | null>(null);
  const [noRoute, setNoRoute] = useState(false);
  const [allowance, setAllowance] = useState<bigint | null>(null);
  const [amountOut, setAmountOut] = useState<bigint | null>(null);
  const [phase, setPhase] = useState<Phase>('form');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [approveNonce, setApproveNonce] = useState(0);

  const instrument = instruments.find((i) => i.id === id);
  const quote = quotes[id];

  useEffect(() => {
    fetch('/api/trade-routes')
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        const d = (await r.json()) as { routes: Route[] };
        const found = d.routes.find((x) => x.instrumentId === id) ?? null;
        setRoute(found);
        setNoRoute(!found);
      })
      .catch(() => setNoRoute(true));
  }, [id]);

  // Shared balance hook: live onchain balances, auto-refreshed every minute.
  const balancesState = useOnchainBalances(address);
  const balances = useMemo(() => {
    const map: Record<string, number> = {};
    for (const b of balancesState.data?.balances ?? []) map[b.instrumentId] = b.amount;
    return map;
  }, [balancesState.data]);

  const payToken = route ? (dir === 'buy' ? route.quoteToken : route.baseToken) : '';
  const payDecimals = route ? (dir === 'buy' ? route.quoteDecimals : route.baseDecimals) : 18;
  const receiveDecimals = route ? (dir === 'buy' ? route.baseDecimals : route.quoteDecimals) : 18;
  const payId = route ? (dir === 'buy' ? route.quoteId : route.instrumentId) : '';
  const receiveId = route ? (dir === 'buy' ? route.instrumentId : route.quoteId) : '';

  useEffect(() => {
    if (!address || !onRobinhoodChain || !payToken) return;
    walletCall(payToken, encodeAllowance(address, SWAP_ROUTER))
      .then((r) => setAllowance(decodeUint(r)))
      .catch(() => setAllowance(0n));
  }, [address, payToken, onRobinhoodChain, approveNonce]);

  const amountIn = useMemo(() => (route ? toUnits(amount, payDecimals) : null), [amount, payDecimals, route]);

  useEffect(() => {
    // ponytail: stale quotes on direction/network change are cleared by the
    // input's own handlers; this effect only fetches, never resets.
    if (!route || !onRobinhoodChain || amountIn === null) return;
    const tokenIn = dir === 'buy' ? route.quoteToken : route.baseToken;
    const tokenOut = dir === 'buy' ? route.baseToken : route.quoteToken;
    const t = setTimeout(() => {
      walletCall(QUOTER_V2, encodeQuoteExactInputSingle(tokenIn, tokenOut, amountIn, route.fee))
        .then((r) => setAmountOut(decodeUint(r)))
        .catch(() => setAmountOut(null)); // e.g. pool has no liquidity path for this size
    }, 350);
    return () => clearTimeout(t);
  }, [route, dir, amountIn, onRobinhoodChain]);

  const minOut = amountOut !== null ? (amountOut * MIN_OUT_NUMERATOR) / MIN_OUT_DENOMINATOR : null;
  const balance = balances[payId];
  const hasBalance = balance === undefined || amountIn === null || balance >= Number(amountIn) / 10 ** payDecimals;
  const needsApprove = allowance !== null && amountIn !== null && allowance < amountIn;
  const busy = phase === 'approving' || phase === 'swapping';
  const canAct =
    !busy &&
    amountIn !== null &&
    amountOut !== null &&
    hasBalance &&
    onRobinhoodChain &&
    phase !== 'done';

  async function runApprove() {
    if (!address || amountIn === null) return;
    setPhase('approving');
    setNotice(null);
    try {
      const hash = await sendTx(address, payToken, encodeApprove(SWAP_ROUTER, amountIn));
      setTxHash(hash);
      const status = await waitForReceipt(hash);
      if (status !== 'success') throw new Error('reverted');
      setAllowance(amountIn);
      setApproveNonce((n) => n + 1);
      setPhase('form');
    } catch (err) {
      setPhase('form');
      setNotice(userMsg(err));
    }
  }

  async function runSwap() {
    if (!address || amountIn === null || amountOut === null) return;
    setPhase('swapping');
    setNotice(null);
    try {
      const tokenIn = dir === 'buy' ? route!.quoteToken : route!.baseToken;
      const tokenOut = dir === 'buy' ? route!.baseToken : route!.quoteToken;
      const hash = await sendTx(
        address,
        SWAP_ROUTER,
        encodeExactInputSingle(tokenIn, tokenOut, route!.fee, address, amountIn, minOut!),
      );
      setTxHash(hash);
      const status = await waitForReceipt(hash);
      if (status === 'success') {
        setPhase('done');
      } else {
        setPhase('form');
        setNotice('The transaction failed onchain. Nothing was swapped.');
      }
    } catch (err) {
      setPhase('form');
      setNotice(userMsg(err));
    }
  }

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
          <h1 className="font-medium">Market not found</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            This trade link points to a market Kovra does not track.
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
                The order form opens as soon as your wallet connects. Your wallet signs every
                transaction: Kovra holds no keys.
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
              No wallet was detected in this browser. Install a crypto wallet such as MetaMask, or
              open Kovra in your wallet&rsquo;s built-in browser.
            </p>
          )}
        </div>
      </div>
    );
  }

  const paySym = dir === 'buy' ? (route?.quoteSymbol ?? '') : sym;
  const receiveSym = dir === 'buy' ? sym : (route?.quoteSymbol ?? '');
  const quotePriceUsd = route ? Number(quotes[route.quoteId]?.price ?? '0') : 0;
  const payUsd = amountIn !== null && quotePriceUsd > 0 ? (Number(amountIn) / 10 ** payDecimals) * quotePriceUsd : null;

  const actionButton = () => {
    if (phase === 'done')
      return (
        <button
          type="button"
          onClick={() => {
            setPhase('form');
            setTxHash(null);
          }}
          className="mt-6 h-12 w-full rounded-control border border-line bg-surface text-sm font-medium transition-colors hover:border-ink"
        >
          Swap again
        </button>
      );
    if (!onRobinhoodChain)
      return (
        <button
          type="button"
          onClick={() => void switchToRobinhoodChain()}
          className="mt-6 h-12 w-full rounded-control bg-ink text-sm font-medium text-white transition-opacity hover:opacity-85"
        >
          Switch wallet to Robinhood Chain
        </button>
      );
    if (amountIn === null)
      return (
        <button type="button" disabled className="mt-6 h-12 w-full rounded-control bg-accent text-sm font-semibold text-ink opacity-40">
          Enter an amount
        </button>
      );
    if (!hasBalance)
      return (
        <button type="button" disabled className="mt-6 h-12 w-full rounded-control bg-accent text-sm font-semibold text-ink opacity-40">
          Not enough {paySym}
        </button>
      );
    if (needsApprove)
      return (
        <button
          type="button"
          disabled={!canAct}
          onClick={() => void runApprove()}
          className="mt-6 h-12 w-full rounded-control border border-line bg-surface text-sm font-medium transition-colors hover:border-ink disabled:opacity-50"
        >
          {phase === 'approving' ? 'Approving…' : `Approve ${paySym} first`}
        </button>
      );
    return (
      <button
        type="button"
        disabled={!canAct}
        onClick={() => void runSwap()}
        className="mt-6 h-12 w-full rounded-control bg-accent text-sm font-semibold text-ink transition-opacity hover:opacity-85 disabled:opacity-40"
      >
        {phase === 'swapping'
          ? 'Swapping…'
          : amountOut === null
            ? 'Getting a quote…'
            : dir === 'buy'
              ? `Buy ${sym}`
              : `Sell ${sym}`}
      </button>
    );
  };

  return (
    <div className="fade-in mx-auto max-w-content px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
      <div className="mx-auto max-w-xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Trade</p>
            <h1 className="mt-3 font-serif text-[36px] font-light leading-tight sm:text-[44px]">
              {sym}
              <span className="ml-2 align-middle font-sans text-sm font-normal text-muted">
                {instrument.name}
              </span>
            </h1>
          </div>
          <div className="text-right">
            <p className="text-2xl font-light">
              <PriceCell price={quote ? formatPrice(quote.price) : null} />
            </p>
            <p className="mt-0.5 text-sm">
              <ChangeLabel pct={quote?.changePct ?? null} />
            </p>
          </div>
        </div>

        {noRoute ? (
          <div className="mt-6 rounded-panel border border-line bg-surface p-5">
            <h2 className="font-medium">No trading pool yet</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {sym} has no Uniswap pool selected on Robinhood Chain right now, so there is nothing
              to swap against. Try again in a moment.
            </p>
          </div>
        ) : !route ? (
          <div className="mt-6 rounded-panel border border-line bg-surface px-5 py-10 text-center">
            <span
              aria-hidden="true"
              className="mx-auto block h-6 w-6 animate-spin rounded-full border-2 border-line border-t-ink"
            />
            <p className="mt-4 text-sm text-muted">Finding your route…</p>
          </div>
        ) : (
          <div className="mt-8 rounded-panel border border-line bg-surface">
            {/* Quiet underline tabs: they are the direction switch, nothing else. */}
            <div className="tab-scroll -mb-px flex gap-6 border-b border-line px-5 pt-4">
              {(['buy', 'sell'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setDir(d);
                    setAllowance(null);
                    setAmountOut(null);
                    setPhase('form');
                    setTxHash(null);
                    setNotice(null);
                  }}
                  aria-pressed={dir === d}
                  className={`h-10 border-b-2 text-sm font-medium transition-colors ${
                    dir === d ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'
                  } disabled:opacity-50`}
                >
                  {d === 'buy' ? `Buy ${sym}` : `Sell ${sym}`}
                </button>
              ))}
            </div>

            <div className="px-5 py-6">
              {/* Pay */}
              <div className="flex items-baseline justify-between gap-2">
                <label htmlFor="trade-amount" className="eyebrow">
                  You pay
                </label>
                <span className="text-xs text-muted tabular-nums">
                  {balances[payId] !== undefined
                    ? `Balance ${balances[payId]!.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${paySym}`
                    : ''}
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-3">
                <input
                  id="trade-amount"
                  inputMode="decimal"
                  autoComplete="off"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value.replace(/[^\d.]/g, ''));
                    setAmountOut(null);
                    setPhase('form');
                    setNotice(null);
                  }}
                  disabled={busy}
                  className="min-w-0 flex-1 bg-transparent font-serif text-4xl font-light tabular-nums outline-none"
                  placeholder="0"
                />
                <span className="shrink-0 text-base font-medium">{paySym}</span>
              </div>

              {/* Receive */}
              <div className="mt-7 flex items-baseline justify-between gap-2 border-t border-line pt-5">
                <p className="eyebrow">You receive</p>
                <span className="text-xs text-muted tabular-nums">
                  {balances[receiveId] !== undefined
                    ? `Balance ${balances[receiveId]!.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${receiveSym}`
                    : ''}
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-3">
                <p className="min-w-0 flex-1 truncate font-serif text-4xl font-light tabular-nums">
                  {amountOut !== null ? fmtAmt(amountOut, receiveDecimals) : amountIn !== null ? '…' : 'n/a'}
                </p>
                <span className="shrink-0 text-base font-medium">{receiveSym}</span>
              </div>
              {amountOut !== null && amountIn !== null && (
                <p className="mt-2 text-xs text-muted tabular-nums">
                  1 {paySym} = {fmtAmt((amountOut * 10n ** BigInt(payDecimals + 6)) / amountIn, receiveDecimals + 6)}{' '}
                  {receiveSym} · at least {fmtAmt(minOut!, receiveDecimals)} {receiveSym} (0.5% guard)
                </p>
              )}

              <dl className="mt-7 space-y-2.5 border-t border-line pt-5 text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-muted">Order value</dt>
                  <dd className="tabular-nums">
                    {payUsd !== null ? `$${payUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : 'n/a'}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-muted">Route</dt>
                  <dd className="flex items-baseline justify-end gap-1 tabular-nums">
                    {dir === 'buy' ? (
                      <>
                        {route.quoteSymbol} <LuArrowRight aria-hidden="true" className="h-3 w-3" /> {sym}
                      </>
                    ) : (
                      <>
                        {sym} <LuArrowRight aria-hidden="true" className="h-3 w-3" /> {route.quoteSymbol}
                      </>
                    )}{' '}
                    · Uniswap {feePct(route.fee)} pool
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

            {actionButton()}

            {notice && (
              <p role="alert" className="mt-3 text-sm leading-relaxed text-negative">
                {notice}
              </p>
            )}

            {txHash && phase !== 'done' && busy && (
              <p className="mt-3 text-sm leading-relaxed text-muted">
                {phase === 'approving' ? 'Approving' : 'Confirming'} onchain…{' '}
                <a
                  href={`${TX_URL}${txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2 hover:text-ink"
                >
                  View on rh-scan
                </a>
              </p>
            )}

            {phase === 'done' && txHash && (
              <div className="mt-6 rounded-control border border-line bg-accent-soft/60 p-4" role="status">
                <p className="font-medium">Swap settled</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  You paid {amount} {paySym} and received at least {minOut !== null ? fmtAmt(minOut, receiveDecimals) : 'n/a'}{' '}
                  {receiveSym}.{' '}
                  <a
                    href={`${TX_URL}${txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2 hover:text-ink"
                  >
                    View the receipt on rh-scan
                  </a>
                  .
                </p>
              </div>
            )}

            <p className="mt-4 text-xs leading-relaxed text-muted">
              The live quote already includes the pool fee, and the minimum-received amount is your
              slippage guard. Your wallet signs every step; Kovra holds no keys and no funds.
            </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
