import { useEffect, useState } from 'react';
import { Chip } from './Chip';

type Step = 'question' | 'typing' | 'answer';

/** How long each loop state holds before advancing. */
const STEP_MS: Record<Step, number> = { question: 1400, typing: 1500, answer: 5200 };

/**
 * Kovra Agent preview: a scripted, illustrative chat loop. No model is wired
 * up and the copy makes no data claims. Reduced-motion users see the finished
 * conversation, no loop.
 */
export function AgentPreview() {
  const [reduced] = useState(
    () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [step, setStep] = useState<Step>(() => (reduced ? 'answer' : 'question'));
  // Bumped on loop reset so the question bubble remounts and its fade-in replays.
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(() => {
      if (step === 'answer') {
        setCycle((c) => c + 1);
        setStep('question');
      } else {
        setStep(step === 'question' ? 'typing' : 'answer');
      }
    }, STEP_MS[step]);
    return () => clearTimeout(t);
  }, [step, reduced]);

  return (
    <section
      aria-labelledby="agent-heading"
      className="rounded-panel border border-line bg-surface p-5 shadow-[0_18px_44px_-20px_rgba(20,23,19,0.35)] transition-transform duration-300 hover:-translate-y-0.5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 id="agent-heading" className="font-medium">
          Kovra Agent
        </h3>
        <Chip>Illustration</Chip>
      </div>
      <p className="mt-1 text-xs text-muted">
        A scripted preview of the assistant — an autonomous agent is not yet integrated.
      </p>

      <div className="mt-4 space-y-3 rounded-control border border-line bg-page p-4">
        <div
          key={cycle}
          className="fade-in ml-auto max-w-[85%] rounded-control bg-ink px-3 py-2 text-sm text-page"
        >
          What moved in my watchlist today?
        </div>

        {step === 'typing' && (
          <div className="fade-in flex items-center gap-2">
            <Avatar />
            <div className="flex gap-1 rounded-control border border-line bg-surface px-3 py-2.5">
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted" />
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted" />
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted" />
            </div>
          </div>
        )}

        {step === 'answer' && (
          <div className="fade-in flex items-end gap-2">
            <Avatar />
            <p className="max-w-[85%] rounded-control border border-line bg-surface px-3 py-2 text-sm leading-relaxed text-muted">
              Here's the day across your tracked universe — biggest movers, category mix, and unusual
              changes. Ask a follow-up any time.
            </p>
          </div>
        )}
      </div>

      {/* Decorative input — the preview card is not interactive. */}
      <div
        aria-hidden="true"
        className="pointer-events-none mt-3 flex items-center justify-between rounded-control border border-line bg-surface px-3 py-2 text-sm text-muted"
      >
        <span>Ask the agent…</span>
        <span aria-hidden="true" className="text-ink">
          ↑
        </span>
      </div>
    </section>
  );
}

function Avatar() {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-[10px] font-semibold text-page">
      K
    </span>
  );
}
