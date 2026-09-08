import type { ReactNode } from 'react';

/** Public-safe service state panel (missing key, outage). No env details, no secrets. */
export function StatePanel({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-panel border border-line bg-surface px-5 py-5">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-line" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{title}</p>
          {children && <div className="mt-1 text-sm leading-relaxed text-muted">{children}</div>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}

/** Static skeleton block, deliberately not animated, never implies live data. */
export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-panel border border-line bg-surface px-4 py-4">
          <div className="h-4 w-16 rounded bg-line/70" />
          <div className="h-3 w-40 rounded bg-line/50" />
          <div className="ml-auto h-4 w-20 rounded bg-line/70" />
        </div>
      ))}
    </div>
  );
}
