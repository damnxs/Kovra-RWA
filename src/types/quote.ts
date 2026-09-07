// Shared client/server contracts. Quote shape is exactly technical.md lines 67-81.

export type Quote = {
  instrumentId: string;
  price: string; // decimal representation
  currency: string;
  provider: string;
  sourceTimestamp: string; // event time, UTC ISO8601
  receivedAt: string; // receipt time, not a replacement for event time
  mode: 'realtime' | 'delayed' | 'snapshot';
  delaySeconds: number | null;
  session: 'open' | 'closed' | 'pre' | 'post' | 'unknown';
  previousClose: string | null;
  changePct: number | null;
  /** Server-side freshness flag, orthogonal to session/mode/connected. */
  stale?: boolean;
};

export type Instrument = {
  id: string;
  symbol: string;
  name: string;
  /** 'etf' = TradFi reference proxy priced off-exchange data; 'token' = ERC-20 on Robinhood Chain. */
  type: 'etf' | 'token';
  category: string;
  currency: 'USD';
  venue: string;
  proxyLabel: string;
  tradable: false;
  description: string;
  /** ERC-20 contract address on Robinhood Chain (chainId 4663) — 'token' instruments only. */
  tokenAddress?: string;
};

export type Status = {
  provider: string;
  transport: 'live' | 'poll' | 'none';
  connected: boolean;
  lastEventAt: string | null;
  rateLimitedUntil: string | null;
  missingKey: boolean;
  demo: boolean;
  /** Non-null when the provider rejected our credentials (401/403) or similar. */
  upstreamError: string | null;
  serverTime: string;
  /** Robinhood Chain node state — independent of the TradFi quote provider. */
  chain: {
    chainId: 4663;
    name: 'Robinhood Chain';
    connected: boolean;
    blockNumber: number | null;
    /** ISO of the last chain frame (head, swap, or transfer) — null when never connected. */
    lastEventAt: string | null;
  };
};

/** A real onchain event observed on Robinhood Chain — never synthesized. */
export type OnchainEvent = {
  id: string;
  kind: 'transfer';
  symbol: string;
  /** Human-readable token amount (decimal-adjusted). */
  amount: string;
  /** USD value at the event's pool price — null before the first price observation. */
  usdValue: number | null;
  from: string;
  to: string;
  txHash: string;
  blockNumber: number;
  at: string; // ISO
};

/** Real swap activity per onchain instrument, accumulated since server connection. */
export type OnchainStats = Record<string, { swaps: number; volumeUsd: number }>;

export type OnchainBalance = {
  instrumentId: string;
  symbol: string;
  /** Decimal-adjusted token balance. */
  amount: number;
  /** Live pool price in USD — null when no price has been observed yet. */
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

export type HistoryResponse =
  | { kind: 'since-connection'; points: HistoryPoint[] }
  | { kind: 'unavailable'; reason: string };
