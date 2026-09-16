import type { GameController } from '../game/controller/GameController';
import { shallowEqual, useGameControllerSelector } from '../game/controller/useGameController';
import { formatDemoCredits } from '../game/utils/formatDemoCredits';

export function ResultOverlay({ controller }: { controller: GameController }) {
  const game = useGameControllerSelector(controller, selectResultState, shallowEqual);
  if (!game.result) return null;

  return (
    <section
      className={`result-overlay ${game.result.kind}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="result-title"
    >
      <div className="result-card">
        <span className="result-laurel">❧ ◆ ❧</span>
        <h2 id="result-title">{game.result.title}</h2>
        <p>{game.result.message}</p>
        {game.result.kind === 'won' && (
          <strong className="result-payout">+ {formatDemoCredits(game.result.payout)}</strong>
        )}
        {game.error?.technicalMessage && <small>{game.error.technicalMessage}</small>}
        {game.result.kind === 'error' ? (
          <div className="recovery-actions">
            <button type="button" onClick={() => void controller.recoverFromError()}>
              {game.error?.recoveryAction === 'new-session' ? 'START NEW SESSION' : 'RECOVER'}
            </button>
            {game.error?.recoveryAction !== 'new-session' && (
              <button type="button" onClick={() => void controller.newDemoSession()}>
                NEW DEMO SESSION
              </button>
            )}
          </div>
        ) : (
          <button type="button" onClick={() => void controller.reset()}>
            {game.result.kind === 'lost' ? 'TRY AGAIN' : 'CONTINUE'}
          </button>
        )}
      </div>
    </section>
  );
}

const selectResultState = (game: ReturnType<GameController['getSnapshot']>) => ({
  result: game.result,
  error: game.error,
});
