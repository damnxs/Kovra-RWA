import type { Instrument } from '../src/types/quote.js';

// Small verified universe. tradable:false — nothing on Kovra is purchasable.
// Never invent volume, market cap, holdings, constituents, or token addresses here.
export const REGISTRY: Instrument[] = [
  {
    id: 'spy',
    symbol: 'SPY',
    name: 'SPDR S&P 500 ETF Trust',
    type: 'etf',
    category: 'Broad Market',
    currency: 'USD',
    venue: 'NYSE Arca',
    proxyLabel: 'S&P 500 ETF proxy',
    tradable: false,
    description:
      'SPY tracks the S&P 500 index of large-cap US equities. On Kovra it serves as a broad-market US equity reference; its price is the ETF share price, not an index level.',
  },
  {
    id: 'qqq',
    symbol: 'QQQ',
    name: 'Invesco QQQ Trust',
    type: 'etf',
    category: 'Technology',
    currency: 'USD',
    venue: 'NASDAQ',
    proxyLabel: 'Nasdaq-100 ETF proxy',
    tradable: false,
    description:
      'QQQ tracks the Nasdaq-100 index, weighted toward large-cap technology companies. On Kovra it serves as a technology-sector reference; its price is the ETF share price, not the Nasdaq-100 index level.',
  },
  {
    id: 'xle',
    symbol: 'XLE',
    name: 'Energy Select Sector SPDR Fund',
    type: 'etf',
    category: 'Energy',
    currency: 'USD',
    venue: 'NYSE Arca',
    proxyLabel: 'Energy sector ETF proxy',
    tradable: false,
    description:
      'XLE tracks the energy sector of the S&P 500. On Kovra it serves as an energy-sector reference; its price is the ETF share price.',
  },
  {
    id: 'xlf',
    symbol: 'XLF',
    name: 'Financial Select Sector SPDR Fund',
    type: 'etf',
    category: 'Financials',
    currency: 'USD',
    venue: 'NYSE Arca',
    proxyLabel: 'Financials sector ETF proxy',
    tradable: false,
    description:
      'XLF tracks the financials sector of the S&P 500. On Kovra it serves as a financials-sector reference; its price is the ETF share price.',
  },
  {
    id: 'xlv',
    symbol: 'XLV',
    name: 'Health Care Select Sector SPDR Fund',
    type: 'etf',
    category: 'Healthcare',
    currency: 'USD',
    venue: 'NYSE Arca',
    proxyLabel: 'Healthcare sector ETF proxy',
    tradable: false,
    description:
      'XLV tracks the health care sector of the S&P 500. On Kovra it serves as a healthcare-sector reference; its price is the ETF share price.',
  },
];

export const BY_SYMBOL = new Map(REGISTRY.map((i) => [i.symbol, i]));

// ---- Onchain instruments (Robinhood Chain, chainId 4663) ----------------------
// Addresses verified by direct eth_call on 2026-09-07 (symbol()/name()/decimals()
// all match). Names are the contracts' own onchain names — Kovra claims no
// affiliation with any issuer; users verify contracts independently.

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
      'A tokenized-equity ERC-20 contract on Robinhood Chain (chainId 4663), listed under this name onchain. Kovra shows its Uniswap pool price — an onchain market price that can differ from the NYSE/Nasdaq quote, and not a claim about the issuer.',
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
      'A tokenized-equity ERC-20 contract on Robinhood Chain (chainId 4663), listed under this name onchain. Kovra shows its Uniswap pool price — an onchain market price that can differ from the exchange quote.',
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
      'A tokenized-equity ERC-20 contract on Robinhood Chain (chainId 4663), listed under this name onchain. Kovra shows its Uniswap pool price — an onchain market price that can differ from the exchange quote.',
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
      'A tokenized-equity ERC-20 contract on Robinhood Chain (chainId 4663), listed under this name onchain. Kovra shows its Uniswap pool price — an onchain market price that can differ from the exchange quote.',
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
      'A tokenized-equity ERC-20 contract on Robinhood Chain (chainId 4663), listed under this name onchain. Kovra shows its Uniswap pool price — an onchain market price that can differ from the exchange quote.',
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
      'A tokenized-equity ERC-20 contract on Robinhood Chain (chainId 4663), listed under this name onchain. Kovra shows its Uniswap pool price — an onchain market price that can differ from the exchange quote.',
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
      'A tokenized-equity ERC-20 contract on Robinhood Chain (chainId 4663), listed under this name onchain. Kovra shows its Uniswap pool price — an onchain market price that can differ from the exchange quote.',
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
      'A tokenized-equity ERC-20 contract on Robinhood Chain (chainId 4663), listed under this name onchain. Kovra shows its Uniswap pool price — an onchain market price that can differ from the exchange quote.',
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
      'An ERC-20 contract on Robinhood Chain (chainId 4663) whose onchain name references SpaceX — a private company with no public exchange listing, so the Uniswap pool price is the only observable market for this token. Verify the contract independently; Kovra claims no affiliation.',
  },
  {
    id: 'weth',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    type: 'token',
    category: 'Crypto',
    currency: 'USD',
    venue: 'Robinhood Chain · Uniswap',
    proxyLabel: 'Native gas asset (wrapped)',
    tradable: false,
    tokenAddress: '0x0bd7d308f8e1639fab988df18a8011f41eacad73',
    description:
      'Wrapped native ETH on Robinhood Chain (chainId 4663). ETH is the chain\'s gas token; WETH is its ERC-20 form. Kovra shows the WETH/USDG Uniswap pool price.',
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

/** All instruments served to the client: TradFi reference proxies + onchain tokens. */
export const ALL_INSTRUMENTS = [...REGISTRY, ...ONCHAIN_INSTRUMENTS];
export const BY_ID = new Map(ALL_INSTRUMENTS.map((i) => [i.id, i]));
export const ONCHAIN_IDS = new Set(ONCHAIN_INSTRUMENTS.map((i) => i.id));
export const SYMBOLS = REGISTRY.map((i) => i.symbol);
