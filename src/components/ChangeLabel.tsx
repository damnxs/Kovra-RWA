import { formatPct, directionWord } from '../lib/format';

/** Change vs previous close: signed value in color plus a visible direction word, never color-only. */
export function ChangeLabel({ pct, word = true }: { pct: number | null | undefined; word?: boolean }) {
  const text = formatPct(pct);
  if (text === null) return <span className="tabular-nums text-muted">n/a</span>;
  const dir = directionWord(pct);
  const color = pct! > 0 ? 'text-positive' : pct! < 0 ? 'text-negative' : 'text-muted';
  return (
    <span className="tabular-nums inline-flex items-baseline gap-1.5 whitespace-nowrap">
      <span className={color}>{text}</span>
      {word && <span className="text-xs text-muted">{dir}</span>}
    </span>
  );
}
