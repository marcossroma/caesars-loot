import { useEffect, useState } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { GameHud } from './components/GameHud';
import { ResultOverlay } from './components/ResultOverlay';
import { DebugOverlay } from './components/DebugOverlay';
import { gameController } from './game/controller/GameController';
import { soundManager } from './game/audio/SoundManager';
import { ErrorToasts } from './components/ErrorToasts';
import { DevProfiler } from './components/DevProfiler';

export function App() {
  const [isCanvasMounted, setIsCanvasMounted] = useState(true);

  useEffect(() => {
    if (!isCanvasMounted) return;
    return gameController.acquireApplicationLifecycle();
  }, [isCanvasMounted]);

  useEffect(() => {
    const detachAudio = soundManager.attach(document);
    void soundManager.preload(['button', 'tilePress', 'safeLoot', 'trap', 'win']);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        soundManager.resume();
        void gameController.handleVisibilityReturn();
      } else {
        soundManager.suspend();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      detachAudio();
      soundManager.stopAll();
    };
  }, []);

  return (
    <main className="game-shell">
      {isCanvasMounted && (
        <DevProfiler id="GameCanvas">
          <GameCanvas controller={gameController} />
        </DevProfiler>
      )}
      {isCanvasMounted && (
        <DevProfiler id="GameHud">
          <GameHud controller={gameController} />
        </DevProfiler>
      )}
      {isCanvasMounted && (
        <DevProfiler id="ResultOverlay">
          <ResultOverlay controller={gameController} />
        </DevProfiler>
      )}
      {isCanvasMounted && <DebugOverlay controller={gameController} />}
      <ErrorToasts />
      {import.meta.env.DEV && (
        <button
          className="dev-cleanup-control"
          type="button"
          onClick={() => {
            if (isCanvasMounted) gameController.disposeRuntimeForDev();
            setIsCanvasMounted((mounted) => !mounted);
          }}
        >
          {isCanvasMounted ? 'Dispose test runtime' : 'Restore test runtime'}
        </button>
      )}
    </main>
  );
}
