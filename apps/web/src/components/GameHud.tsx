import type { GameController } from '../game/controller/GameController';
import { shallowEqual, useGameControllerSelector } from '../game/controller/useGameController';
import { soundManager } from '../game/audio/SoundManager';
import { useGameSettings } from '../game/settings/useGameSettings';
import { formatDemoCredits } from '../game/utils/formatDemoCredits';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';

const credits = (value: number) => formatDemoCredits(value).replace(' credits', '');

const selectHudState = (game: ReturnType<GameController['getSnapshot']>) => ({
  gameState: game.gameState,
  demoCredits: game.demoCredits,
  multiplier: game.multiplier,
  potentialLoot: game.potentialLoot,
  safeReveals: game.safeReveals,
  bet: game.bet,
  trapCount: game.trapCount,
  allowedBets: game.allowedBets,
  allowedTrapCounts: game.allowedTrapCounts,
  socketState: game.socketState,
  history: game.history,
});

function StepControl({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  options: readonly number[];
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  const index = options.indexOf(value);
  return (
    <div className="step-control" role="group" aria-label={label}>
      <span>{label}</span>
      <div>
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          disabled={disabled || index <= 0}
          onClick={() => {
            soundManager.play('button');
            onChange(options[index - 1] ?? value);
          }}
        >
          −
        </button>
        <strong>{value}</strong>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          disabled={disabled || index >= options.length - 1}
          onClick={() => {
            soundManager.play('button');
            onChange(options[index + 1] ?? value);
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}

export function GameHud({ controller }: { controller: GameController }) {
  const game = useGameControllerSelector(controller, selectHudState, shallowEqual);
  const animatedCredits = useAnimatedNumber(game.demoCredits);
  const animatedMultiplier = useAnimatedNumber(game.multiplier, 300);
  const animatedLoot = useAnimatedNumber(game.potentialLoot, 340);
  const settings = useGameSettings();
  const canConfigure = game.gameState === 'READY';
  const canStart = canConfigure && game.bet <= game.demoCredits && game.socketState === 'connected';
  const canCashOut = game.gameState === 'PLAYING' && game.safeReveals > 0;

  return (
    <aside
      className="game-hud"
      aria-label="Heist controls"
      aria-description="Fictional demo credits. No real money."
    >
      {game.socketState !== 'connected' && (
        <div className="socket-warning" role="status">
          {game.socketState === 'reconnecting' ? 'Reconnecting realtime…' : 'Realtime unavailable'}
        </div>
      )}
      <div className="hud-state">
        <span className="state-dot" />
        {game.gameState}
      </div>
      <div className="hud-stats">
        <div>
          <span>Demo credits</span>
          <strong>{credits(animatedCredits)}</strong>
        </div>
        <div>
          <span>Multiplier</span>
          <strong>{animatedMultiplier.toFixed(2)}×</strong>
        </div>
        <div>
          <span>Potential loot</span>
          <strong>{credits(animatedLoot)}</strong>
        </div>
        <div>
          <span>Safe vaults</span>
          <strong>{game.safeReveals}</strong>
        </div>
      </div>

      <div className="hud-config">
        <StepControl
          label="Bet"
          value={game.bet}
          options={game.allowedBets}
          disabled={!canConfigure}
          onChange={(value) => controller.setBet(value)}
        />
        <StepControl
          label="Traps"
          value={game.trapCount}
          options={game.allowedTrapCounts}
          disabled={!canConfigure}
          onChange={(value) => controller.setTrapCount(value)}
        />
      </div>

      <details className="hud-settings">
        <summary aria-label="Open game settings">
          {settings.muted ? '🔇 MUTED' : `🔊 ${Math.round(settings.volume * 100)}%`}
        </summary>
        <section aria-label="Game settings">
          <strong>SETTINGS</strong>
          <button
            type="button"
            aria-pressed={!settings.muted}
            onClick={() => {
              soundManager.setMuted(!settings.muted);
              if (settings.muted)
                void soundManager.unlock().then(() => soundManager.play('button'));
            }}
          >
            SOUND {settings.muted ? 'OFF' : 'ON'}
          </button>
          <label>
            <span>VOLUME</span>
            <output>{Math.round(settings.volume * 100)}%</output>
            <input
              aria-label="Sound volume"
              type="range"
              min="0"
              max="100"
              step="5"
              value={Math.round(settings.volume * 100)}
              onChange={(event) => soundManager.setVolume(Number(event.target.value) / 100)}
            />
          </label>
          <button
            type="button"
            aria-pressed={settings.reducedEffects}
            onClick={() => {
              soundManager.play('button');
              controller.setReducedEffects(!settings.reducedEffects);
            }}
          >
            FX {settings.reducedEffects ? 'REDUCED' : 'FULL'}
          </button>
        </section>
      </details>

      <div className="hud-actions">
        <button
          className="start-heist"
          type="button"
          disabled={!canStart}
          onClick={() => {
            soundManager.play('button');
            void controller.startHeist();
          }}
        >
          START HEIST
        </button>
        <button
          className="cash-out"
          type="button"
          disabled={!canCashOut}
          onClick={() => void controller.cashOut()}
        >
          ESCAPE WITH LOOT
        </button>
      </div>

      <div className="round-history" aria-label="Last five rounds">
        <span>Last raids</span>
        <div>
          {game.history.length === 0 && <small>No raids yet</small>}
          {game.history.map((item) => (
            <i
              className={item.result}
              key={item.roundId}
              title={`${item.result}: ${credits(item.payout)}`}
            >
              {item.result === 'won' ? '◆' : '☠'}
            </i>
          ))}
        </div>
      </div>
    </aside>
  );
}
