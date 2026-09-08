// Shared client/server contracts. Everything is onchain (Robinhood Chain),
// so quotes carry no TradFi session/delay concepts.

export type Quote = {
  instrumentId: string;
  price: string; // decimal representation
  currency: string;
  provider: string;
  sourceTimestamp: string; // event time, UTC ISO8601
  receivedAt: string; // receipt time, not a replacement for event time
  previousClose: string | null; // since-connection anchor price
  changePct: number | null;
  /** Server-side freshness flag: chain connected but silent too long. */
  stale?: boolean;
};

export type Instrument = {
  id: string;
  symbol: string;
  name: string;
  /** ERC-20 on Robinhood Chain. */
  type: 'token';
  category: string;
  currency: 'USD';
  venue: string;
  proxyLabel: string;
  tradable: false;
  description: string;
  /** ERC-20 contract address on Robinhood Chain (chainId 4663). */
  tokenAddress: string;
};

export type Status = {
  serverTime: string;
  /** Robinhood Chain node state, the single upstream. */
  chain: {
    chainId: 4663;
    name: 'Robinhood Chain';
    connected: boolean;
    blockNumber: number | null;
    /** ISO of the last chain frame (head, swap, or transfer), null when never connected. */
    lastEventAt: string | null;
  };
};

/** A real onchain event observed on Robinhood Chain, never synthesized. */
export type OnchainEvent = {
  id: string;
  kind: 'transfer';
  symbol: string;
  /** Human-readable token amount (decimal-adjusted). */
  amount: string;
  /** USD value at the event's pool price, null before the first price observation. */
  usdValue: number | null;
  from: string;
  to: string;
  txHash: string;
  blockNumber: number;
  at: string; // ISO
};

/** Real swap activity per onchain instrument: rolling 1h window once backfilled. */
export type OnchainStats = Record<string, {
  swaps: number;
  volumeUsd: number;
  /** Pool TVL in USD (both pool balances × live price), absent until the first refresh. */
  tvlUsd?: number;
  /** True once the 1h log backfill covered this instrument; before that, counts are since connect. */
  backfilled?: boolean;
}>;

export type OnchainBalance = {
  instrumentId: string;
  symbol: string;
  /** Decimal-adjusted token balance. */
  amount: number;
  /** Live pool price in USD, null when no price has been observed yet. */
  priceUsd: number | null;
  valueUsd: number | null;
};

export type OnchainBalances = {
  address: string;
  chainId: 4663;
  /** Native ETH gas balance, decimal-adjusted. */
  eth: number;
  ethValueUsd: number | null;
  balances: OnchainBalance[];
  totalValueUsd: number | null;
  fetchedAt: string;
};

export type HistoryPoint = { t: number; p: string };

/** One line of the live chain log. Every entry is a real observed chain event. */
export type ChainLogEntry = {
  id: string;
  kind: 'block' | 'swap' | 'transfer' | 'tvl' | 'conn';
  /** Receipt time, ISO. */
  at: string;
  blockNumber?: number;
  /** rh-scan link target for swap/transfer entries. */
  txHash?: string;
  /** Instrument symbol for swap/transfer/tvl entries. */
  symbol?: string;
  /** Swap: pool price after the swap. */
  price?: number;
  /** Swap: which side the taker was on, relative to the base token. */
  side?: 'buy' | 'sell';
  /** Swap: the token the base was paid with or received as (e.g. USDG). */
  quoteSymbol?: string;
  /** Swap/transfer: USD size. TVL: refreshed pool TVL. */
  usdValue?: number | null;
  /** Transfer: decimal-adjusted token amount. */
  amount?: number;
  /** Transfer: counterparties. */
  from?: string;
  to?: string;
  /** Conn lines: human detail ('connected', 'disconnected'). */
  detail?: string;
};

export type HistoryResponse =
  | { kind: 'since-connection'; points: HistoryPoint[] }
  | { kind: 'unavailable'; reason: string };
