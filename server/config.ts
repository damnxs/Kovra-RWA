import 'dotenv/config';

function bool(v: string | undefined, fallback = false): boolean {
  if (v === undefined || v === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
}

export const config = {
  provider: process.env.MARKET_DATA_PROVIDER ?? 'finnhub',
  finnhubApiKey: (process.env.FINNHUB_API_KEY ?? '').trim(),
  mode: process.env.MARKET_DATA_MODE ?? 'development',
  publicDisplayApproved: bool(process.env.PUBLIC_DISPLAY_APPROVED, false),
  demoMode: bool(process.env.DEMO_MODE, false),
  port: Number(process.env.PORT ?? 8787),
  // Test hooks: point at a local stub to exercise 429/401/reconnect paths offline.
  finnhubApiBase: process.env.FINNHUB_API_BASE ?? 'https://finnhub.io/api/v1',
  finnhubWsUrl: process.env.FINNHUB_WS_URL ?? 'wss://ws.finnhub.io',
  // Robinhood Chain (Arbitrum Orbit, chainId 4663) — onchain RWA data. Real public
  // data, no key; independent of DEMO_MODE (that flag only governs TradFi quotes).
  chainEnabled: bool(process.env.KOVRA_CHAIN_ENABLED, true),
  chainWsUrl: process.env.KOVRA_CHAIN_WS ?? 'ws://40.160.13.247:8546',
  // HTTP endpoint — wallet_addEthereumChain requires an https/http RPC URL.
  chainHttpUrl: process.env.KOVRA_CHAIN_HTTP ?? 'http://40.160.13.247:8545',
};

export const missingKey = config.provider === 'finnhub' && config.finnhubApiKey === '';
