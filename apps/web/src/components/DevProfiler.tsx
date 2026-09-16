import { Profiler, type ReactNode } from 'react';

interface CommitMetrics {
  commits: number;
  totalDurationMs: number;
  maxDurationMs: number;
}

declare global {
  interface Window {
    __CAESARS_LOOT_REACT__?: Record<string, CommitMetrics>;
  }
}

const metrics: Record<string, CommitMetrics> = {};
if (import.meta.env.DEV) window.__CAESARS_LOOT_REACT__ = metrics;

export function DevProfiler({ id, children }: { id: string; children: ReactNode }) {
  if (!import.meta.env.DEV) return children;
  return (
    <Profiler
      id={id}
      onRender={(profileId, _phase, actualDuration) => {
        const current = metrics[profileId] ?? {
          commits: 0,
          totalDurationMs: 0,
          maxDurationMs: 0,
        };
        current.commits += 1;
        current.totalDurationMs += actualDuration;
        current.maxDurationMs = Math.max(current.maxDurationMs, actualDuration);
        metrics[profileId] = current;
      }}
    >
      {children}
    </Profiler>
  );
}
