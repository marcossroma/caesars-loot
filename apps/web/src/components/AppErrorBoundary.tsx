import { Component, type ErrorInfo, type ReactNode } from 'react';
import { gameController } from '../game/controller/GameController';

interface State {
  error: Error | null;
}

export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    if (import.meta.env.DEV) console.error('React render recovered by ErrorBoundary.', error, info);
  }

  private restart = (): void => {
    this.setState({ error: null });
    void gameController.restartGame(false);
  };

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="fatal-error" role="alert">
        <section className="result-card">
          <span className="result-laurel">❧ ◆ ❧</span>
          <h1>THE HEIST HIT A SNAG</h1>
          <p>The game view stopped safely. Your demo settings are still preserved.</p>
          {import.meta.env.DEV && <small>{this.state.error.message}</small>}
          <button type="button" onClick={this.restart}>
            RESTART GAME
          </button>
        </section>
      </main>
    );
  }
}
