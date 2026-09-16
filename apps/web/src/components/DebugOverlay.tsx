import { useState } from 'react';
import type { GameController } from '../game/controller/GameController';
import { useGameController } from '../game/controller/useGameController';
import type { CharacterState } from '../game/character/characterTypes';
import type { DevEffect } from '../game/effects/GameFeelDirector';
import { soundManager, type SoundCue } from '../game/audio/SoundManager';
import { useSoundDiagnostics } from '../game/audio/useSoundDiagnostics';
import { useErrorStore } from '../game/errors/useErrorStore';

const characterTestStates: CharacterState[] = ['idle', 'happy', 'scared', 'celebrate', 'caught'];
const effectTests: DevEffect[] = [
  'goldSpark',
  'coinBurst',
  'gemSparkle',
  'smoke',
  'dust',
  'safe',
  'trap',
  'win',
  'lose',
];
const soundTests: SoundCue[] = [
  'button',
  'tilePress',
  'safeLoot',
  'coin',
  'gem',
  'trap',
  'cashout',
  'win',
  'lose',
];

export function DebugOverlay({ controller }: { controller: GameController }) {
  const game = useGameController(controller);
  const sound = useSoundDiagnostics();
  const errors = useErrorStore();
  const [simulateRenderFailure, setSimulateRenderFailure] = useState(false);
  if (!import.meta.env.DEV) return null;
  if (simulateRenderFailure) throw new Error('Simulated React render failure');

  const pixi = window.__CAESARS_LOOT_PIXI__;
  const react = window.__CAESARS_LOOT_REACT__ ?? {};
  const appToInteractive = performance.getEntriesByName('caesars-loot:app-to-interactive').at(-1);

  return (
    <aside className="debug-overlay" aria-label="Development game state">
      <details>
        <summary>DEV</summary>
        <div className="debug-overlay-content">
          <output>
            State:{game.gameState} · Round:{game.roundId ?? '—'} · Revealed:
            {game.revealedTiles.length} · Multiplier:{game.multiplier.toFixed(2)} · Credits:
            {game.demoCredits.toFixed(2)} · API:{game.apiStatus}/{game.latencyMs ?? '—'}ms · WS:
            {game.socketState} · Socket:{game.socketId ?? '—'} · Ping:{game.socketPingMs ?? '—'}ms ·
            Last:
            {game.lastSocketEvent ?? '—'} · Age:
            {game.lastSocketEventAt ? `${Date.now() - game.lastSocketEventAt}ms` : '—'} ·
            Reconnects:
            {game.reconnectAttempts}
          </output>
          <output>
            React commits — Canvas:{react['GameCanvas']?.commits ?? 0} · HUD:
            {react['GameHud']?.commits ?? 0} · Result:{react['ResultOverlay']?.commits ?? 0}
          </output>
          <output>
            Audio:{sound.unlocked ? 'unlocked' : 'locked'} · Muted:{String(sound.muted)} · Volume:
            {Math.round(sound.volume * 100)}% · Voices:{sound.activeVoices} · Gesture listener:
            {String(sound.attached)}
          </output>
          <div className="socket-debug-actions" aria-label="Recovery tester">
            {(['rest', 'timeout', 'session', 'asset'] as const).map((kind) => (
              <button type="button" key={kind} onClick={() => controller.simulateErrorForDev(kind)}>
                Simulate {kind}
              </button>
            ))}
            <button type="button" onClick={() => setSimulateRenderFailure(true)}>
              Simulate render error
            </button>
          </div>
          <div className="socket-debug-actions" aria-label="Sound tester">
            {soundTests.map((cue) => (
              <button type="button" key={cue} onClick={() => soundManager.play(cue)}>
                Sound {cue}
              </button>
            ))}
          </div>
          <output>
            Character:{game.character.state} · Animation:{game.character.animation} · Queue:
            {game.character.queueSize} · Scale:{game.character.scale.toFixed(2)} · Ticker:
            {game.character.tickerCallbacks} · Reduced motion:
            {String(game.character.reducedMotion)}
          </output>
          <output>
            FPS current/avg5/min:{game.effects.fps}/{game.effects.fpsAverage5s}/
            {game.effects.fpsMinimum} · Frame:{game.effects.frameTimeMs.toFixed(2)}ms · FX:
            {game.effects.activeParticles}/{game.effects.maxParticles} · Pool
            created/available/peak:
            {game.effects.createdParticles}/{game.effects.availableParticles}/
            {game.effects.peakActiveParticles} · Quality:{game.effects.quality} · Camera:
            {game.effects.cameraState} · Scheduled:{game.effects.scheduledEffects} · Listeners:
            {game.effects.listenerCount} · Tickers:{game.effects.tickerCallbacks}
          </output>
          <output>
            Pixi objects:{pixi?.displayObjects ?? '—'} · Sprites:{pixi?.spriteCount ?? '—'} ·
            Graphics:{pixi?.graphicsCount ?? '—'} · Containers:{pixi?.containerCount ?? '—'} · Text:
            {pixi?.textCount ?? '—'} · Scene tickers:{pixi?.tickerCallbacks ?? '—'} · Viewport:
            {pixi?.lastViewport ?? '—'} · DPR:{window.devicePixelRatio} · TGI:
            {appToInteractive ? `${appToInteractive.duration.toFixed(1)}ms` : '—'}
          </output>
          <div className="socket-debug-actions">
            <button type="button" onClick={() => controller.disconnectSocketForDev()}>
              Disconnect WS
            </button>
            <button type="button" onClick={() => void controller.reconnectSocketForDev()}>
              Reconnect WS
            </button>
          </div>
          <div className="socket-debug-actions" aria-label="Effect tester">
            {effectTests.map((effect) => (
              <button
                type="button"
                key={effect}
                onClick={() => controller.playEffectForDev(effect)}
              >
                {effect}
              </button>
            ))}
            {[0, 50, 100, 250].map((count) => (
              <button
                type="button"
                key={count}
                onClick={() => controller.stressEffectsForDev(count)}
              >
                Stress {count}
              </button>
            ))}
            <button type="button" onClick={() => controller.toggleReducedMotionForDev()}>
              Reduced motion: {game.effects.reducedMotion ? 'on' : 'off'}
            </button>
          </div>
          <div className="socket-debug-actions" aria-label="Character animation tester">
            {characterTestStates.map((state) => (
              <button
                type="button"
                key={state}
                onClick={() => controller.playCharacterAnimationForDev(state)}
              >
                Play {state[0]?.toUpperCase()}
                {state.slice(1)}
              </button>
            ))}
          </div>
          <ol aria-label="Bounded error log">
            {errors.log.map((entry, index) => (
              <li key={`${entry.code}-${entry.timestamp}-${index}`}>
                {entry.code}@{entry.context ?? 'app'}
              </li>
            ))}
          </ol>
          <ol aria-label="Socket event log">
            {game.socketEventLog.map((entry, index) => (
              <li key={`${entry}-${index}`}>{entry}</li>
            ))}
          </ol>
        </div>
      </details>
    </aside>
  );
}
