/**
 * One shared EventSource for the whole app, browsers cap SSE connections per
 * host, so providers subscribe through this module instead of opening their own
 * sockets. Lazily connects on the first subscriber; EventSource handles its own
 * reconnection. Never closed: it is app-lifetime.
 */

type Handler = (data: unknown) => void;

const handlers = new Map<string, Set<Handler>>();
const attached = new Set<string>();
let es: EventSource | null = null;

function attach(name: string) {
  if (!es || attached.has(name)) return;
  attached.add(name);
  es.addEventListener(name, (ev) => {
    let data: unknown;
    try {
      data = JSON.parse((ev as MessageEvent).data);
    } catch {
      return; // malformed frame: drop, EventSource stays connected
    }
    for (const h of handlers.get(name) ?? []) h(data);
  });
}

/** Subscribe to one SSE event name; returns an unsubscribe function. */
export function onStreamEvent(name: string, handler: Handler): () => void {
  let set = handlers.get(name);
  if (!set) {
    set = new Set();
    handlers.set(name, set);
  }
  set.add(handler);
  if (!es) {
    es = new EventSource('/api/stream');
    for (const n of handlers.keys()) attach(n);
  } else {
    attach(name);
  }
  return () => {
    set!.delete(handler);
  };
}
