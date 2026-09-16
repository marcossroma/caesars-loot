import { useEffect, useRef, useState } from 'react';
import { acquirePixiRuntime, type PixiRuntimeStatus } from '../game/runtime/PixiRuntime';
import type { GameController } from '../game/controller/GameController';

const INITIAL_STATUS: PixiRuntimeStatus = {
  phase: 'booting',
  progress: 0,
};

export function GameCanvas({ controller }: { controller: GameController }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<PixiRuntimeStatus>(INITIAL_STATUS);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const handleStatus = (nextStatus: PixiRuntimeStatus) => {
      setStatus(nextStatus);
      void controller.handleRuntimeStatus(nextStatus).then(() => {
        if (nextStatus.phase !== 'ready') return;
        performance.mark('caesars-loot:session-ready');
      });
    };
    return acquirePixiRuntime(host, handleStatus, controller);
  }, [controller]);

  return (
    <section className="game-stage" aria-label="Interactive 5x5 Caesar’s Loot game board.">
      <div className="canvas-host" ref={hostRef} />

      {status.phase === 'booting' && (
        <div className="dom-loading-fallback" aria-hidden="true">
          <p className="dom-loading-title">CAESAR’S LOOT</p>
          <p>Loading treasures...</p>
        </div>
      )}

      {status.phase === 'error' && (
        <div className="load-error" role="alert">
          <strong>CAESAR’S LOOT</strong>
          <span>The vault could not be opened.</span>
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        {status.phase === 'ready'
          ? 'Caesar’s Loot is ready.'
          : `Loading treasures: ${Math.round(status.progress * 100)} percent.`}
      </p>
      <p className="sr-only">
        The board is rendered in Canvas. Full keyboard navigation will be added in a future
        accessibility milestone.
      </p>
    </section>
  );
}
