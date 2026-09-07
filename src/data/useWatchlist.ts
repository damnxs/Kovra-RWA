import { useCallback, useState } from 'react';
import { appendActivity } from './activity';

const KEY = 'kovra:watchlist';

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return []; // localStorage can throw (private mode, quota, disabled)
  }
}

function write(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* ignore — watchlist simply won't persist */
  }
}

/**
 * Local watchlist of watched instruments — explicitly not owned exposure.
 * Works without a wallet; the stored id list is the state a future wallet-sync
 * would migrate. Toggling is recorded in the local activity log.
 */
export function useWatchlist(): {
  ids: string[];
  toggle: (id: string, symbol?: string) => void;
  has: (id: string) => boolean;
} {
  const [ids, setIds] = useState<string[]>(read);

  const toggle = useCallback((id: string, symbol?: string) => {
    setIds((prev) => {
      const removing = prev.includes(id);
      const next = removing ? prev.filter((x) => x !== id) : [...prev, id];
      write(next);
      if (symbol) {
        appendActivity({
          kind: removing ? 'watchlist-removed' : 'watchlist-added',
          symbol,
        });
      }
      return next;
    });
  }, []);

  const has = useCallback((id: string) => ids.includes(id), [ids]);

  return { ids, toggle, has };
}
