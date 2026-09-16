import { errorStore } from '../game/errors/ErrorStore';
import { useErrorStore } from '../game/errors/useErrorStore';

export function ErrorToasts() {
  const { toasts } = useErrorStore();
  if (toasts.length === 0) return null;
  return (
    <aside className="error-toasts" aria-label="Game notices">
      {toasts.map((error) => (
        <div key={error.id} role="status">
          <span>
            <strong>{error.category}</strong>
            {error.message}
          </span>
          <button
            type="button"
            aria-label="Dismiss notice"
            onClick={() => errorStore.dismiss(error.id)}
          >
            ×
          </button>
        </div>
      ))}
    </aside>
  );
}
