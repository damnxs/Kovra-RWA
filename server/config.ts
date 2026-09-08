import 'dotenv/config';

function bool(v: string | undefined, fallback = false): boolean {
  if (v === undefined || v === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
}

export const config = {
  port: Number(process.env.PORT ?? 8787),
  // Robinhood Chain (Arbitrum Orbit, chainId 4663), the single data source.
  // Real public chain data, no key.
  chainEnabled: bool(process.env.KOVRA_CHAIN_ENABLED, true),
  chainWsUrl: process.env.KOVRA_CHAIN_WS ?? 'ws://40.160.13.247:8546',
  // HTTP endpoint, wallet_addEthereumChain requires an http(s) RPC URL.
  chainHttpUrl: process.env.KOVRA_CHAIN_HTTP ?? 'http://40.160.13.247:8545',
  // LLM via OpenRouter, spoken to with the OpenAI SDK. No key = agent disabled.
  // The model id never leaves the server: no API response or UI mentions it.
  llmApiKey: process.env.OPENROUTER_API_KEY ?? '',
  llmModel: process.env.KOVRA_LLM_MODEL ?? 'deepseek/deepseek-chat',
};
