import { useEffect, useRef, useState } from 'react';
import {
  LuArrowLeftRight,
  LuArrowRight,
  LuBook,
  LuChartLine,
  LuLayers,
  LuRefreshCw,
} from 'react-icons/lu';

/**
 * Kovra Agent chat, welcome-first layout. The LLM lives server-side
 * (server/llm.ts): OpenAI SDK through OpenRouter, running a tool loop over
 * live chain state (pool prices, swaps, volume, TVL) before answering. No key
 * on the server = 503 and the UI says so, never a fake conversation. The
 * model identity stays server-side; nothing here names it.
 */
type ChatMsg = {
  role: 'user' | 'agent';
  text: string;
  error?: boolean;
  tools?: string[];
  suggestions?: string[];
};

const MAX_CHARS = 1000;

/** Tool ids to quiet labels, shown under a reply so the agent shows its work. */
const TOOL_LABELS: Record<string, string> = {
  get_live_quotes: 'live quotes',
  get_pool_stats: 'pool stats',
  get_price_history: 'price history',
  analyze_technicals: 'technicals',
  get_recent_activity: 'chain activity',
  get_market_info: 'contract info',
  get_trade_route: 'swap route',
  get_wallet_snapshot: 'wallet read',
};

/** Rotating starters, all market questions the tools can answer with real data. */
const PROMPTS = [
  'What is the price of NVDA right now?',
  'Is NVDA trending up or down?',
  'How volatile is TSLA?',
  'Show me the latest trades on AAPL',
  'Which market moved the most since you connected?',
  'Which pool holds the most value?',
  'Compare AAPL and TSLA prices right now',
  'How would a GME swap route onchain?',
  'Which market traded the most in the last hour?',
  'What is a tokenized stock?',
  'How does Kovra read prices from the chain?',
  'What is the pool price of GME?',
  'How liquid is the NVDA pool?',
  'Explain the USDG contract',
  'Which markets are down since you connected?',
  'Show me the busiest market right now',
];

/** 4 distinct prompts per rotation; "More questions" walks to the next set. */
function promptSet(seed: number): string[] {
  return Array.from({ length: 4 }, (_, i) => PROMPTS[(seed + i * 3) % PROMPTS.length]!);
}

/** Fallback suggestions: starter prompts the thread has not used yet. */
function unusedPrompts(messages: ChatMsg[], n: number): string[] {
  const used = new Set(messages.filter((m) => m.role === 'user').map((m) => m.text));
  return PROMPTS.filter((p) => !used.has(p)).slice(0, n);
}

/** One icon per starter card: trend, compare, layers, book. */
const CARD_ICONS = [LuChartLine, LuArrowLeftRight, LuLayers, LuBook];

function CardIcon({ i }: { i: number }) {
  const Icon = CARD_ICONS[i % 4]!;
  return (
    <Icon
      aria-hidden="true"
      strokeWidth={1.5}
      className="h-4 w-4 text-muted transition-colors group-hover:text-ink"
    />
  );
}

/** Quiet busy-state phrases, cycled while the agent works through its tools. */
const PHASES = ['Checking the live pools…', 'Reading the chain log…', 'Crunching indicators…'];

export function Agent() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [seed, setSeed] = useState(0);
  const [phase, setPhase] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length > 0) bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy]);

  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setPhase((p) => (p + 1) % PHASES.length), 1600);
    return () => clearInterval(t);
  }, [busy]);

  async function send(text: string) {
    setBusy(true);
    setDraft('');
    const thread: ChatMsg[] = [...messages, { role: 'user', text }];
    setMessages(thread);
    try {
      const r = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: thread.map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text })),
        }),
      });
      const d = (await r.json()) as { reply?: string; error?: string; tools?: string[]; suggestions?: string[] };
      if (!r.ok || !d.reply) throw new Error(d.error ?? `HTTP ${r.status}`);
      setMessages([
        ...thread,
        {
          role: 'agent',
          text: d.reply,
          tools: d.tools ?? [],
          suggestions: (d.suggestions ?? []).filter(Boolean).slice(0, 3),
        },
      ]);
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'unknown';
      setMessages([
        ...thread,
        {
          role: 'agent',
          text:
            reason === 'agent-disabled'
              ? 'The agent is not enabled on this server yet.'
              : 'The agent could not answer right now. Try again in a moment.',
          error: true,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  const over = draft.length > MAX_CHARS;
  const canSend = draft.trim().length > 0 && !busy && !over;

  return (
    <div className="fade-in mx-auto flex min-h-[calc(100svh-150px)] w-full max-w-3xl flex-col px-5 sm:px-8">
      {messages.length === 0 ? (
        <div className="flex flex-1 flex-col justify-center gap-9 py-16">
          <div>
            <h1 className="font-serif text-[34px] font-light leading-tight sm:text-[44px]">
              Ask the chain.
              <br />
              <span className="italic">Anything, answered with live data.</span>
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Start with a question below, or type your own. Every answer is grounded in live pool
              data.
            </p>
          </div>

          <div>
            <div key={seed} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {promptSet(seed).map((p, i) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => void send(p)}
                  className="fade-in group flex h-full flex-col justify-between gap-8 rounded-panel border border-line bg-surface p-4 text-left transition-colors duration-200 hover:border-ink"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <span className="text-[13px] font-medium leading-snug">{p}</span>
                  <CardIcon i={i} />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setSeed((s) => s + 1)}
              className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-ink"
            >
              <LuRefreshCw aria-hidden="true" strokeWidth={1.8} className="h-3.5 w-3.5" />
              More questions
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 space-y-3 pt-12">
          {messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div className="fade-in max-w-[85%]">
                <div
                  role={m.error ? 'alert' : undefined}
                  className={`rounded-panel px-4 py-2.5 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-ink text-white'
                      : m.error
                        ? 'border border-negative/40 bg-page text-negative'
                        : 'border border-line bg-page text-muted'
                  }`}
                >
                  {m.text}
                </div>
                {m.role === 'agent' && !m.error && m.tools && m.tools.length > 0 && (
                  <p className="mt-1.5 flex flex-wrap gap-1.5 pl-1" aria-label="Data sources used">
                    {m.tools.map((t, j) => (
                      <span
                        key={`${t}-${j}`}
                        className="rounded-control border border-line bg-surface px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em] text-muted"
                      >
                        {TOOL_LABELS[t] ?? t}
                      </span>
                    ))}
                  </p>
                )}
                {m.role === 'agent' && !m.error && !busy && i === messages.length - 1 && (
                  <div className="mt-2 flex flex-col items-start gap-1.5">
                    {(m.suggestions?.length ? m.suggestions : unusedPrompts(messages, 3)).map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => void send(q)}
                        className="fade-in rounded-control border border-line bg-surface px-3 py-1.5 text-left text-xs font-medium text-muted transition-colors duration-200 hover:border-ink hover:text-ink"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex justify-start" aria-live="polite">
              <div className="fade-in rounded-panel border border-line bg-page px-4 py-2.5 text-sm text-muted">
                {PHASES[phase]}
              </div>
            </div>
          )}
        </div>
      )}

      <div ref={bottomRef} />

      <form
        className="mb-10 rounded-panel border border-line bg-surface p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSend) return;
          void send(draft.trim());
        }}
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask the Kovra agent…"
          aria-label="Message the Kovra agent"
          className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-muted"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-muted">Answers use live prices, read from Robinhood Chain pools.</p>
          <div className="flex shrink-0 items-center gap-3">
            <span className={`text-xs tabular-nums ${over ? 'text-negative' : 'text-muted'}`}>
              {draft.length}/{MAX_CHARS}
            </span>
            <button
              type="submit"
              disabled={!canSend}
              aria-label="Send"
              className="flex h-9 w-9 items-center justify-center rounded-control bg-accent text-ink transition-opacity duration-200 hover:opacity-85 disabled:opacity-40"
            >
              <LuArrowRight aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
