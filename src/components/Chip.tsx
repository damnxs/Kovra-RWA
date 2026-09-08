import type { ReactNode } from 'react';

type Tone = 'neutral' | 'positive' | 'negative' | 'accent' | 'warn';

const TONES: Record<Tone, string> = {
  neutral: 'border-line bg-surface text-muted',
  positive: 'border-transparent bg-surface text-positive',
  negative: 'border-transparent bg-surface text-negative',
  accent: 'border-transparent bg-accent-soft text-ink',
  warn: 'border-line bg-accent-soft text-ink',
};

/** Small status chip. Never the only carrier of meaning, pair with text. */
export function Chip({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-control border px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
