import { useEffect, useRef, useState } from 'react';

/**
 * Price text with tabular numerals and a brief highlight, but only when a real
 * source event changed the value. No aria-live: ticks are not announced.
 */
export function PriceCell({
  price,
  className = '',
}: {
  price: string | null | undefined;
  className?: string;
}) {
  const prev = useRef<string | null | undefined>(price);
  const [dir, setDir] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    if (prev.current !== undefined && prev.current !== null && price !== prev.current) {
      const up = Number(price) > Number(prev.current);
      setDir(up ? 'up' : 'down');
      const t = setTimeout(() => setDir(null), 600);
      prev.current = price;
      return () => clearTimeout(t);
    }
    prev.current = price;
  }, [price]);

  const cls = dir === 'up' ? 'flash-up' : dir === 'down' ? 'flash-down' : '';
  return (
    <span className={`tabular-nums inline-block rounded px-1 py-0.5 -mx-1 ${cls} ${className}`}>
      {price ?? '—'}
    </span>
  );
}
