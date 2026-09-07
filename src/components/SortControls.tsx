export type SortKey = 'name' | 'change';

/** Sorting, deliberately separate from category tabs. */
export function SortControls({
  value,
  onChange,
}: {
  value: SortKey;
  onChange: (v: SortKey) => void;
}) {
  const opts: Array<{ key: SortKey; label: string }> = [
    { key: 'name', label: 'Name' },
    { key: 'change', label: "Today's change" },
  ];
  return (
    <div className="flex items-center gap-2" role="group" aria-label="Sort instruments">
      <span className="text-sm text-muted">Sort by</span>
      <div className="flex rounded-control border border-line bg-surface p-0.5">
        {opts.map(({ key, label }) => {
          const active = key === value;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(key)}
              className={`flex h-11 items-center rounded-[5px] px-3 text-sm font-medium transition-colors ${
                active ? 'bg-accent text-ink' : 'text-muted hover:text-ink'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
