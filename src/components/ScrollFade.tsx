import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Scroll affordance: wraps a `tab-scroll` scroller (its first child) and fades
 * edges where more content exists. Used by the category tab strip and market pulse.
 */
export function ScrollFade({
  children,
  tone = 'page',
  className = '',
}: {
  children: ReactNode;
  /** Background the fade blends into. */
  tone?: 'page' | 'surface';
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const el = wrapRef.current?.firstElementChild;
    if (!el) return;
    const update = () =>
      setEdges({
        left: el.scrollLeft > 4,
        right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
      });
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    // Tabs/items mount after data loads — re-measure when children change.
    const mo = new MutationObserver(update);
    mo.observe(el, { childList: true, subtree: true });
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
      mo.disconnect();
    };
  }, []);

  const from = tone === 'surface' ? 'from-surface' : 'from-page';
  return (
    <div ref={wrapRef} className={`relative min-w-0 ${className}`}>
      {children}
      {edges.left && (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r ${from} to-transparent`}
        />
      )}
      {edges.right && (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l ${from} to-transparent`}
        />
      )}
    </div>
  );
}
