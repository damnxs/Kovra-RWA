import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Scroll-reveal wrapper: fades content up the first time it enters the
 * viewport (IntersectionObserver, once). Reduced-motion users see it
 * immediately — reveal is decoration, never information.
 */
export function Reveal({
  children,
  className = '',
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  /** Stagger in ms — shifts the transition, not the detection. */
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Reduced-motion users see content immediately — reveal is decoration, never
  // information. Computed once as the initial state, no effect needed for it.
  const [shown, setShown] = useState(
    () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const el = ref.current;
    if (!el || shown) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown]);

  return (
    <div
      ref={ref}
      className={`reveal ${shown ? 'reveal-shown' : ''} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
