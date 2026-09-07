import { Router } from 'express';
import { ALL_INSTRUMENTS } from './registry.js';
import { config } from './config.js';
import { getQuotes, getStatus, getPoints, getOnchainEvents, addSseClient, chainUsable } from './store.js';
import { getBalances, getWalletTransfers, getStats } from './chain.js';

export const api = Router();

api.get('/markets', (_req, res) => {
  res.json({ instruments: ALL_INSTRUMENTS });
});

api.get('/quotes', (_req, res) => {
  res.json({ quotes: getQuotes(), status: getStatus() });
});

api.get('/stream', (req, res) => {
  // Headers + flush make SSE work through proxies (Vite dev proxy, nginx-style buffers).
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();
  addSseClient(res);
  req.on('close', () => res.end());
});

api.get('/history', (req, res) => {
  const id = String(req.query.id ?? '');
  const points = getPoints(id);
  if (points.length < 2) {
    // /stock/candle is premium-only; we never fabricate a full-day series.
    res.json({ kind: 'unavailable', reason: 'insufficient-observations' });
    return;
  }
  res.json({ kind: 'since-connection', points });
});

// ---- Onchain (Robinhood Chain, chainId 4663) ---------------------------------------

/** Live transfer feed + real swap stats, accumulated since server connection. */
api.get('/onchain/feed', (_req, res) => {
  res.json({ events: getOnchainEvents(), stats: getStats(), chain: getStatus().chain });
});

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/** Read-only wallet balances on Robinhood Chain — eth_getBalance + balanceOf. */
api.get('/onchain/balances', async (req, res) => {
  const address = String(req.query.address ?? '');
  if (!ADDRESS_RE.test(address)) {
    res.status(400).json({ error: 'invalid-address' });
    return;
  }
  if (!chainUsable()) {
    res.status(503).json({ error: 'chain-unavailable', chain: getStatus().chain });
    return;
  }
  try {
    res.json(await getBalances(address));
  } catch {
    res.status(502).json({ error: 'chain-read-failed' });
  }
});

/** Real ERC-20 transfer history of tracked tokens for one wallet (~4h window). */
api.get('/onchain/transfers', async (req, res) => {
  const address = String(req.query.address ?? '');
  if (!ADDRESS_RE.test(address)) {
    res.status(400).json({ error: 'invalid-address' });
    return;
  }
  if (!chainUsable()) {
    res.status(503).json({ error: 'chain-unavailable', chain: getStatus().chain });
    return;
  }
  try {
    res.json({ events: await getWalletTransfers(address), windowHours: 4 });
  } catch {
    res.status(502).json({ error: 'chain-read-failed' });
  }
});

/** Network parameters for wallet_addEthereumChain — one source of truth. */
api.get('/chain-config', (_req, res) => {
  res.json({
    chainId: '0x1237', // 4663 — Robinhood Chain
    chainName: 'Robinhood Chain',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: [config.chainHttpUrl],
  });
});
