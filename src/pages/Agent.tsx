import { useState } from 'react';
import { Chip } from '../components/Chip';
import { RefreshStatus } from '../components/RefreshStatus';

/**
 * Kovra Agent — the AI chat is token-gated: it requires holding KOVRA, and no
 * token contract exists yet, so every attempt answers with the honest error
 * instead of an invented conversation.
 */
type ChatMsg = { role: 'user' | 'agent'; text: string; error?: boolean };

const HOLD_REQUIREMENT = 'You need to hold KOVRA token to use the AI agent.';

export function Agent() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState('');

  return (
    <div className="fade-in mx-auto max-w-content px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Kovra Agent</p>
          <h1 className="mt-3 font-serif text-[36px] leading-tight sm:text-[44px]">Agent.</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Deterministic analysis of the data Kovra can actually verify. Nothing here is generated
            or speculative — every insight names its source, and what cannot be computed yet says
            so instead of guessing.
          </p>
        </div>
        <RefreshStatus />
      </div>

      {/* AI chat — gated on holding KOVRA. No token contract exists yet, so
          every send returns the requirement notice, never a fake answer. */}
      <section
        aria-labelledby="chat-heading"
        className="mt-4 rounded-panel border border-line bg-surface p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="chat-heading" className="font-medium">
            AI agent chat
          </h2>
          <Chip tone="warn">Holds KOVRA required</Chip>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Ask the agent about markets, your watchlist, or your portofolio. Chat access is gated by
          KOVRA token balance — the token and its verification are not live yet, so requests cannot
          be answered today.
        </p>

        <div className="mt-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div
                role={m.error ? 'alert' : undefined}
                className={`max-w-[85%] rounded-panel px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-ink text-white'
                    : m.error
                      ? 'border border-negative/40 bg-page text-negative'
                      : 'border border-line bg-page text-muted'
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
        </div>

        <form
          className="mt-4 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            const text = draft.trim();
            if (!text) return;
            setMessages((ms) => [
              ...ms,
              { role: 'user', text },
              { role: 'agent', text: HOLD_REQUIREMENT, error: true },
            ]);
            setDraft('');
          }}
        >
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask the Kovra agent…"
            aria-label="Message the Kovra agent"
            className="h-11 min-w-0 flex-1 rounded-control border border-line bg-page px-4 text-sm outline-none transition-colors placeholder:text-muted focus:border-ink"
          />
          <button
            type="submit"
            className="h-11 shrink-0 rounded-control bg-ink px-5 text-sm font-medium text-white transition-opacity hover:opacity-85"
          >
            Send
          </button>
        </form>
      </section>
    </div>
  );
}
