import type { Ticker } from 'pixi.js';

interface TweenOptions {
  id: string;
  from: number;
  to: number;
  duration: number;
  onUpdate: (value: number) => void;
  onComplete?: () => void;
}

interface ActiveTween extends TweenOptions {
  elapsed: number;
}

function easeOutCubic(progress: number): number {
  return 1 - (1 - progress) ** 3;
}

export class TweenManager {
  private readonly tweens = new Map<string, ActiveTween>();

  constructor(private readonly ticker: Ticker) {
    ticker.add(this.update);
  }

  to(options: TweenOptions): void {
    this.tweens.set(options.id, { ...options, elapsed: 0 });
  }

  cancel(id: string): void {
    this.tweens.delete(id);
  }

  destroy(): void {
    this.ticker.remove(this.update);
    this.tweens.clear();
  }

  private readonly update = (ticker: Ticker): void => {
    const deltaMilliseconds = ticker.deltaMS;

    for (const [id, tween] of this.tweens) {
      tween.elapsed += deltaMilliseconds;
      const progress = Math.min(tween.elapsed / tween.duration, 1);
      const value = tween.from + (tween.to - tween.from) * easeOutCubic(progress);
      tween.onUpdate(value);

      if (progress >= 1) {
        this.tweens.delete(id);
        tween.onComplete?.();
      }
    }
  };
}
