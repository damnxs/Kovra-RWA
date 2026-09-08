import { useRef } from 'react';
import { ScrollFade } from './ScrollFade';

/** Horizontal category tabs: roving arrow-key focus, lime selection, 44px targets. */
export function CategoryTabs({
  categories,
  selected,
  onSelect,
  listId,
}: {
  categories: string[];
  selected: string;
  onSelect: (c: string) => void;
  listId: string;
}) {
  const tabsRef = useRef<Array<HTMLButtonElement | null>>([]);

  const move = (from: number, delta: number) => {
    const next = (from + delta + categories.length) % categories.length;
    tabsRef.current[next]?.focus();
    onSelect(categories[next]!);
  };

  return (
    <ScrollFade className="-mx-1 min-w-0 flex-1">
      <div role="tablist" aria-label="Market categories" className="tab-scroll flex gap-1 py-1">
        {categories.map((c, i) => {
          const isSel = c === selected;
          return (
            <button
              key={c}
              ref={(el) => {
                tabsRef.current[i] = el;
              }}
              role="tab"
              id={`tab-${c.toLowerCase().replace(/[^a-z]+/g, '-')}`}
              aria-selected={isSel}
              aria-controls={listId}
              tabIndex={isSel ? 0 : -1}
              onClick={() => onSelect(c)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight') move(i, 1);
                else if (e.key === 'ArrowLeft') move(i, -1);
                else if (e.key === 'Home') move(i, -i);
                else if (e.key === 'End') move(i, categories.length - 1 - i);
              }}
              className={`flex h-11 shrink-0 items-center rounded-control px-4 text-sm font-medium transition-colors ${
                isSel ? 'bg-accent text-ink' : 'text-muted hover:bg-accent-soft/60 hover:text-ink'
              }`}
            >
              {c}
            </button>
          );
        })}
      </div>
    </ScrollFade>
  );
}
