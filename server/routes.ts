import { Router } from 'express';
import { ALL_INSTRUMENTS } from './registry.js';
import { config } from './config.js';
import { getQuotes, getStatus, getPoints, getOnchainEvents, getChainLog, addSseClient, chainUsable } from './store.js';
import { getBalances, getWalletTransfers, getStats, getTradeRoutes, SWAP_ROUTER, QUOTER_V2 } from './chain.js';
import { askAgent, agentEnabled, type AgentMessage } from './llm.js';

export const api = Router();

api.get('/markets', (_req, res) => {
  res.json({ instruments: ALL_INSTRUMENTS, agent: { enabled: agentEnabled() } });
});

/** Agent chat, OpenAI SDK through OpenRouter; key stays server-side. */
api.post('/agent/chat', async (req, res) => {
  const raw = req.body?.messages;
  const messages: AgentMessage[] = Array.isArray(raw)
    ? raw
        .filter((m: unknown) => {
          const r = (m as { role?: unknown })?.role;
          return r === 'user' || r === 'assistant';
        })
        .map((m: { role: 'user' | 'assistant'; content: unknown }) => ({
          role: m.role,
          content: String(m.content ?? '').slice(0, 2000),
        }))
        .slice(-12)
    : [];
  if (messages.length === 0 || messages[messages.length - 1]!.role !== 'user') {
    res.status(400).json({ error: 'invalid-messages' });
    return;
  }
  if (!agentEnabled()) {
    res.status(503).json({ error: 'agent-disabled' });
    return;
  }
  try {
    const { reply, tools, suggestions } = await askAgent(messages);
    res.json({ reply, tools, suggestions });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(msg === 'agent-disabled' ? 503 : 502).json({ error: msg });
  }
});

api.get('/quotes', (_req, res) => {
  res.json({ quotes: getQuotes(), status: getStatus() });
});

/** Swap routing info: router + quoter addresses and each market's pool tier. */
api.get('/trade-routes', async (_req, res) => {
  if (!chainUsable()) {
    res.status(503).json({ error: 'chain-unavailable' });
    return;
  }
  try {
    res.json({ router: SWAP_ROUTER, quoter: QUOTER_V2, routes: await getTradeRoutes() });
  } catch {
    res.status(502).json({ error: 'chain-read-failed' });
  }
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

/** Live transfer feed + real swap stats + the live chain log ring. */
api.get('/onchain/feed', (_req, res) => {
  res.json({
    events: getOnchainEvents(),
    stats: getStats(),
    log: getChainLog(),
    chain: getStatus().chain,
  });
});

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/** Read-only wallet balances on Robinhood Chain, eth_getBalance + balanceOf. */
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

/** Network parameters for wallet_addEthereumChain, one source of truth. */
api.get('/chain-config', (_req, res) => {
  res.json({
    chainId: '0x1237', // 4663, Robinhood Chain
    chainName: 'Robinhood Chain',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: [config.chainHttpUrl],
  });
});
