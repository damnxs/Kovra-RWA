import type { Instrument } from '../src/types/quote.js';

// The verified universe: ERC-20 instruments on Robinhood Chain, priced from
// their Uniswap pools. tradable:false, nothing on Kovra is purchasable.
// Never invent volume, market cap, holdings, or token addresses here.
// Addresses verified by direct eth_call on 2026-09-07 (symbol()/name()/decimals()
// all match). Names are the contracts' own onchain names, Kovra claims no
// affiliation with any issuer; users verify contracts independently.
//
// Stock tokens only, by project decision (2026-09-08). WETH is deliberately
// absent as a market: most stock pools quote against it, so chain.ts keeps a
// WETH/USDG pool internally as the live cross-rate, but WETH is never listed,
// counted, or backfilled. USDG stays as the $1 peg reference.

export const ONCHAIN_INSTRUMENTS: Instrument[] = [
  {
    id: 'nvda',
    symbol: 'NVDA',
    name: 'NVIDIA • Robinhood Token',
    type: 'token',
    category: 'Tokenized stocks',
    currency: 'USD',
    venue: 'Robinhood Chain · Uniswap',
    proxyLabel: 'Tokenized equity',
    tradable: false,
    tokenAddress: '0xd0601ce157db5bdc3162bbac2a2c8af5320d9eec',
    description:
      'A tokenized-equity ERC-20 contract on Robinhood Chain (chainId 4663), listed under this name onchain. Kovra shows its Uniswap pool price, an onchain market price that can differ from the NYSE/Nasdaq quote, and not a claim about the issuer.',
  },
  {
    id: 'aapl',
    symbol: 'AAPL',
    name: 'Apple • Robinhood Token',
    type: 'token',
    category: 'Tokenized stocks',
    currency: 'USD',
    venue: 'Robinhood Chain · Uniswap',
    proxyLabel: 'Tokenized equity',
    tradable: false,
    tokenAddress: '0xaf3d76f1834a1d425780943c99ea8a608f8a93f9',
    description:
      'A tokenized-equity ERC-20 contract on Robinhood Chain (chainId 4663), listed under this name onchain. Kovra shows its Uniswap pool price, an onchain market price that can differ from the exchange quote.',
  },
  {
    id: 'tsla',
    symbol: 'TSLA',
    name: 'Tesla • Robinhood Token',
    type: 'token',
    category: 'Tokenized stocks',
    currency: 'USD',
    venue: 'Robinhood Chain · Uniswap',
    proxyLabel: 'Tokenized equity',
    tradable: false,
    tokenAddress: '0x322f0929c4625ed5bad873c95208d54e1c003b2d',
    description:
      'A tokenized-equity ERC-20 contract on Robinhood Chain (chainId 4663), listed under this name onchain. Kovra shows its Uniswap pool price, an onchain market price that can differ from the exchange quote.',
  },
  {
    id: 'amzn',
    symbol: 'AMZN',
    name: 'Amazon • Robinhood Token',
    type: 'token',
    category: 'Tokenized stocks',
    currency: 'USD',
    venue: 'Robinhood Chain · Uniswap',
    proxyLabel: 'Tokenized equity',
    tradable: false,
    tokenAddress: '0x12f190a9f9d7d37a250758b26824b97ce941bf54',
    description:
      'A tokenized-equity ERC-20 contract on Robinhood Chain (chainId 4663), listed under this name onchain. Kovra shows its Uniswap pool price, an onchain market price that can differ from the exchange quote.',
  },
  {
    id: 'googl',
    symbol: 'GOOGL',
    name: 'Alphabet Class A • Robinhood Token',
    type: 'token',
    category: 'Tokenized stocks',
    currency: 'USD',
    venue: 'Robinhood Chain · Uniswap',
    proxyLabel: 'Tokenized equity',
    tradable: false,
    tokenAddress: '0x2e0847e8910a9732eb3fb1bb4b70a580adad4fe3',
    description:
      'A tokenized-equity ERC-20 contract on Robinhood Chain (chainId 4663), listed under this name onchain. Kovra shows its Uniswap pool price, an onchain market price that can differ from the exchange quote.',
  },
  {
    id: 'djt',
    symbol: 'DJT',
    name: 'Trump Media • Robinhood Token',
    type: 'token',
    category: 'Tokenized stocks',
    currency: 'USD',
    venue: 'Robinhood Chain · Uniswap',
    proxyLabel: 'Tokenized equity',
    tradable: false,
    tokenAddress: '0x1d11f0496982706c5e14a514d4e79f2e6bde4516',
    description:
      'A tokenized-equity ERC-20 contract on Robinhood Chain (chainId 4663), listed under this name onchain. Kovra shows its Uniswap pool price, an onchain market price that can differ from the exchange quote.',
  },
  {
    id: 'gme',
    symbol: 'GME',
    name: 'GameStop • Robinhood Token',
    type: 'token',
    category: 'Tokenized stocks',
    currency: 'USD',
    venue: 'Robinhood Chain · Uniswap',
    proxyLabel: 'Tokenized equity',
    tradable: false,
    tokenAddress: '0x1b0e319c6a659f002271b69db8a7df2f911c153e',
    description:
      'A tokenized-equity ERC-20 contract on Robinhood Chain (chainId 4663), listed under this name onchain. Kovra shows its Uniswap pool price, an onchain market price that can differ from the exchange quote.',
  },
  {
    id: 'amc',
    symbol: 'AMC',
    name: 'AMC • Robinhood Token',
    type: 'token',
    category: 'Tokenized stocks',
    currency: 'USD',
    venue: 'Robinhood Chain · Uniswap',
    proxyLabel: 'Tokenized equity',
    tradable: false,
    tokenAddress: '0x05a3d1cd21d0c88145e82600e62e7e496e0f222b',
    description:
      'A tokenized-equity ERC-20 contract on Robinhood Chain (chainId 4663), listed under this name onchain. Kovra shows its Uniswap pool price, an onchain market price that can differ from the exchange quote.',
  },
  {
    id: 'msft',
    symbol: 'MSFT',
    name: 'Microsoft • Robinhood Token',
    type: 'token',
    category: 'Tokenized stocks',
    currency: 'USD',
    venue: 'Robinhood Chain · Uniswap',
    proxyLabel: 'Tokenized equity',
    tradable: false,
    tokenAddress: '0xe93237c50d904957cf27e7b1133b510c669c2e74',
    description:
      'A tokenized-equity ERC-20 contract on Robinhood Chain (chainId 4663), listed under this name onchain. Kovra shows its Uniswap pool price, an onchain market price that can differ from the exchange quote.',
  },
  {
    id: 'meta',
    symbol: 'META',
    name: 'Meta Platforms • Robinhood Token',
    type: 'token',
    category: 'Tokenized stocks',
    currency: 'USD',
    venue: 'Robinhood Chain · Uniswap',
    proxyLabel: 'Tokenized equity',
    tradable: false,
    tokenAddress: '0xc0d6457c16cc70d6790dd43521c899c87ce02f35',
    description:
      'A tokenized-equity ERC-20 contract on Robinhood Chain (chainId 4663), listed under this name onchain. Kovra shows its Uniswap pool price, an onchain market price that can differ from the exchange quote.',
  },
  {
    id: 'coin',
    symbol: 'COIN',
    name: 'Coinbase • Robinhood Token',
    type: 'token',
    category: 'Tokenized stocks',
    currency: 'USD',
    venue: 'Robinhood Chain · Uniswap',
    proxyLabel: 'Tokenized equity',
    tradable: false,
    tokenAddress: '0x6330d8c3178a418788df01a47479c0ce7ccf450b',
    description:
      'A tokenized-equity ERC-20 contract on Robinhood Chain (chainId 4663), listed under this name onchain. Kovra shows its Uniswap pool price, an onchain market price that can differ from the exchange quote.',
  },
  {
    id: 'spy',
    symbol: 'SPY',
    name: 'SPDR S&P 500 ETF Trust • Robinhood Token',
    type: 'token',
    category: 'Tokenized ETFs',
    currency: 'USD',
    venue: 'Robinhood Chain · Uniswap',
    proxyLabel: 'Tokenized ETF',
    tradable: false,
    tokenAddress: '0x117cc2133c37b721f49de2a7a74833232b3b4c0c',
    description:
      'A tokenized-ETF ERC-20 contract on Robinhood Chain (chainId 4663), listed under this name onchain. Kovra shows its Uniswap pool price, an onchain market price that can differ from the NYSE Arca quote of the underlying ETF.',
  },
  {
    id: 'qqq',
    symbol: 'QQQ',
    name: 'Invesco QQQ • Robinhood Token',
    type: 'token',
    category: 'Tokenized ETFs',
    currency: 'USD',
    venue: 'Robinhood Chain · Uniswap',
    proxyLabel: 'Tokenized ETF',
    tradable: false,
    tokenAddress: '0xd5f3879160bc7c32ebb4dc785f8a4f505888de68',
    description:
      'A tokenized-ETF ERC-20 contract on Robinhood Chain (chainId 4663), listed under this name onchain. Kovra shows its Uniswap pool price, an onchain market price that can differ from the Nasdaq quote of the underlying ETF.',
  },
  {
    id: 'spcx',
    symbol: 'SPCX',
    name: 'SpaceX • Robinhood Token',
    type: 'token',
    category: 'Tokenized private assets',
    currency: 'USD',
    venue: 'Robinhood Chain · Uniswap',
    proxyLabel: 'Tokenized private asset',
    tradable: false,
    tokenAddress: '0x4a0e65a3eccec6dbe60ae065f2e7bb85fae35eea',
    description:
      'An ERC-20 contract on Robinhood Chain (chainId 4663) whose onchain name references SpaceX, a private company with no public exchange listing, so the Uniswap pool price is the only observable market for this token. Verify the contract independently; Kovra claims no affiliation.',
  },
  {
    id: 'usdg',
    symbol: 'USDG',
    name: 'Global Dollar',
    type: 'token',
    category: 'Stablecoins',
    currency: 'USD',
    venue: 'Robinhood Chain',
    proxyLabel: 'USD stablecoin',
    tradable: false,
    tokenAddress: '0x5fc5360d0400a0fd4f2af552add042d716f1d168',
    description:
      'Global Dollar (USDG), a USD stablecoin issued by Paxos, deployed on Robinhood Chain. Shown at its $1.00 issuer redemption rate, not a pool price; onchain it trades against WETH and the tokenized-equity pools.',
  },
];

/** All instruments served to the client: the onchain token universe. */
export const ALL_INSTRUMENTS = ONCHAIN_INSTRUMENTS;
export const BY_ID = new Map(ALL_INSTRUMENTS.map((i) => [i.id, i]));
export const ONCHAIN_IDS = new Set(ONCHAIN_INSTRUMENTS.map((i) => i.id));
