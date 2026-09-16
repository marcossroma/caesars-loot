import type { Container, Ticker } from 'pixi.js';
import type { CharacterViewPort } from './CharacterView';
import { calculateResponsiveLayout } from '../responsive/layout.config';
import {
  CHARACTER_EASING,
  CHARACTER_PRIORITIES,
  CHARACTER_TIMING,
  type CharacterDiagnostics,
  type CharacterPort,
  type CharacterPose,
  type CharacterState,
} from './characterTypes';

interface CharacterControllerOptions {
  ticker: CharacterTicker;
  view: CharacterViewPort;
  onDiagnostics?: (diagnostics: CharacterDiagnostics) => void;
  random?: () => number;
  reducedMotion?: boolean;
}

interface CharacterTicker {
  add(callback: (ticker: Ticker) => void): object | void;
  remove(callback: (ticker: Ticker) => void): object | void;
}

const BASE_POSE: CharacterPose = {
  x: 0,
  y: 0,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  headRotation: 0,
  shadowScale: 1,
  shadowAlpha: 0.42,
  coinAlpha: 1,
  bodyTint: 0xffffff,
};

const stableStates = new Set<CharacterState>(['idle', 'thinking', 'scared', 'caught']);

export class CharacterController implements CharacterPort {
  readonly root: Container;

  private readonly ticker: CharacterTicker;
  private readonly view: CharacterViewPort;
  private readonly onDiagnostics: ((diagnostics: CharacterDiagnostics) => void) | undefined;
  private readonly random: () => number;
  private readonly pose: CharacterPose = { ...BASE_POSE };
  private state: CharacterState = 'idle';
  private animation = 'breathing';
  private pendingState: CharacterState | null = null;
  private elapsed = 0;
  private duration = Number.POSITIVE_INFINITY;
  private viewportScale = 1;
  private roundActive = false;
  private reducedMotion: boolean;
  private disposed = false;
  private mediaQuery: MediaQueryList | null = null;

  constructor(options: CharacterControllerOptions) {
    this.ticker = options.ticker;
    this.view = options.view;
    this.root = options.view.root;
    this.onDiagnostics = options.onDiagnostics;
    this.random = options.random ?? Math.random;
    this.reducedMotion = options.reducedMotion ?? this.readReducedMotionPreference();
    this.bindReducedMotionPreference(options.reducedMotion);
    this.ticker.add(this.update);
    this.view.setState('idle');
    this.emitDiagnostics();
  }

  get currentState(): CharacterState {
    return this.state;
  }

  play(state: CharacterState, force = false): boolean {
    if (this.disposed) return false;
    if (!force && CHARACTER_PRIORITIES[state] < CHARACTER_PRIORITIES[this.state]) {
      if (!stableStates.has(this.state)) {
        this.pendingState = state;
        this.emitDiagnostics();
      }
      return false;
    }
    this.activate(state);
    return true;
  }

  playForDev(state: CharacterState): void {
    this.play(state, true);
  }

  setRoundActive(active: boolean): void {
    this.roundActive = active;
  }

  setReducedMotion(active: boolean): void {
    this.reducedMotion = active;
    this.emitDiagnostics();
  }

  syncGameState(gameState: string): void {
    if (gameState === 'READY') {
      this.reset();
    } else if (gameState === 'STARTING') {
      this.play('anticipation');
    } else if (gameState === 'PLAYING') {
      this.roundActive = true;
      this.play('thinking');
    } else if (gameState === 'WON' && this.state !== 'celebrate') {
      this.roundActive = false;
      this.play('celebrate', true);
    } else if (gameState === 'LOST' && this.state !== 'caught') {
      this.roundActive = false;
      this.play('caught', true);
    }
  }

  reset(): void {
    if (this.disposed) return;
    this.roundActive = false;
    this.pendingState = null;
    this.activate('idle');
    this.view.resetPose();
  }

  resize(viewportWidth: number, viewportHeight: number): void {
    const layout = calculateResponsiveLayout(viewportWidth, viewportHeight);
    if (layout.mode === 'mobile') {
      this.viewportScale = Math.min(layout.characterScale, Math.max(0.15, viewportWidth / 2_150));
      this.root.position.set(22, Math.min(116, viewportHeight * 0.135));
    } else if (layout.mode === 'tablet') {
      this.viewportScale = layout.characterScale;
      this.root.position.set(30, Math.min(132, viewportHeight * 0.13));
    } else if (layout.mode === 'compact-landscape') {
      this.viewportScale = layout.characterScale;
      this.root.position.set(46, viewportHeight - 18);
    } else {
      this.viewportScale = Math.min(0.86, Math.max(layout.characterScale, viewportHeight / 920));
      this.root.position.set(Math.min(218, viewportWidth * 0.15), viewportHeight * 0.82);
    }
    this.root.scale.set(this.viewportScale);
    this.emitDiagnostics();
  }

  getDiagnostics(): CharacterDiagnostics {
    return {
      state: this.state,
      animation: this.animation,
      queueSize: this.pendingState ? 1 : 0,
      scale: this.viewportScale,
      tickerCallbacks: this.disposed ? 0 : 1,
      reducedMotion: this.reducedMotion,
    };
  }

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.ticker.remove(this.update);
    this.mediaQuery?.removeEventListener('change', this.handleMotionPreference);
    this.mediaQuery = null;
    this.pendingState = null;
    this.view.destroy();
    this.emitDiagnostics();
  }

  private activate(state: CharacterState): void {
    this.state = state;
    this.elapsed = 0;
    this.pendingState = null;
    this.duration = this.durationFor(state);
    this.animation = this.animationFor(state);
    this.resetMutablePose();
    this.view.resetPose();
    this.view.setState(state);
    this.emitDiagnostics();
  }

  private readonly update = (ticker: Ticker): void => {
    if (this.disposed) return;
    const delta = Math.min(ticker.deltaMS, 50);
    this.elapsed += delta;
    this.updatePose();
    this.view.applyPose(this.pose);
    if (this.elapsed >= this.duration) this.completeAnimation();
  };

  private updatePose(): void {
    this.resetMutablePose();
    const motion = this.reducedMotion ? CHARACTER_TIMING.reducedMotionFactor : 1;
    const progress = Number.isFinite(this.duration) ? Math.min(this.elapsed / this.duration, 1) : 0;

    switch (this.state) {
      case 'idle': {
        const phase = (this.elapsed / CHARACTER_TIMING.idleBreath) * Math.PI * 2;
        this.pose.scaleY = 1 + Math.sin(phase) * 0.014 * motion;
        this.pose.scaleX = 1 - Math.sin(phase) * 0.007 * motion;
        this.pose.rotation = Math.sin(phase * 0.5) * 0.012 * motion;
        this.pose.headRotation = Math.sin(phase * 0.35) * 0.018 * motion;
        break;
      }
      case 'thinking': {
        const phase = (this.elapsed / CHARACTER_TIMING.thinkingSway) * Math.PI * 2;
        this.pose.rotation = -0.035 * motion + Math.sin(phase) * 0.018 * motion;
        this.pose.headRotation = 0.09 * motion + Math.sin(phase * 0.6) * 0.025 * motion;
        break;
      }
      case 'anticipation': {
        const bounce = Math.sin(progress * Math.PI);
        this.pose.y = -18 * bounce * motion;
        this.pose.rotation = -0.08 * bounce * motion;
        this.pose.scaleX = 1 + 0.05 * bounce * motion;
        this.pose.scaleY = 1 - 0.04 * bounce * motion;
        this.pose.shadowScale = 1 - 0.12 * bounce * motion;
        break;
      }
      case 'happy': {
        const jump = Math.sin(progress * Math.PI);
        const strength =
          this.animation === 'happy-big' ? 1.35 : this.animation === 'happy-small' ? 0.72 : 1;
        this.pose.y = -34 * jump * strength * motion;
        this.pose.scaleX = 1 - 0.07 * jump * motion;
        this.pose.scaleY = 1 + 0.09 * jump * motion;
        this.pose.rotation = Math.sin(progress * Math.PI * 2) * 0.045 * motion;
        this.pose.shadowScale = 1 - 0.25 * jump * motion;
        break;
      }
      case 'surprised': {
        const recoil = CHARACTER_EASING.outBack(progress);
        this.pose.y = -25 * recoil * motion;
        this.pose.scaleX = 1.1;
        this.pose.scaleY = 0.93;
        this.pose.rotation = -0.08 * motion;
        this.pose.bodyTint = 0xffb8aa;
        break;
      }
      case 'scared': {
        const shake = Math.sin(this.elapsed * 0.085) * 5 * motion;
        this.pose.x = shake;
        this.pose.rotation = Math.sin(this.elapsed * 0.07) * 0.035 * motion;
        this.pose.scaleX = 0.97;
        this.pose.scaleY = 1.03;
        this.pose.bodyTint = 0xffd2ca;
        break;
      }
      case 'escape': {
        const eased = CHARACTER_EASING.outCubic(progress);
        this.pose.x = 48 * eased * motion;
        this.pose.y = -Math.abs(Math.sin(progress * Math.PI * 4)) * 13 * motion;
        this.pose.rotation = 0.1 * eased * motion;
        this.pose.coinAlpha = 1 - progress;
        break;
      }
      case 'celebrate': {
        if (this.animation === 'victory-hold') {
          const phase = (this.elapsed / 1_800) * Math.PI * 2;
          this.pose.y = -5 - Math.sin(phase) * 2 * motion;
          this.pose.rotation = Math.sin(phase) * 0.012 * motion;
          break;
        }
        const activeProgress = Math.min(this.elapsed / CHARACTER_TIMING.celebration, 1);
        const jump = Math.abs(Math.sin(activeProgress * Math.PI * 3));
        this.pose.y = -28 * jump * motion;
        this.pose.rotation = Math.sin(activeProgress * Math.PI * 4) * 0.055 * motion;
        this.pose.shadowScale = 1 - jump * 0.2 * motion;
        break;
      }
      case 'caught': {
        const settle = CHARACTER_EASING.outCubic(Math.min(this.elapsed / 420, 1));
        this.pose.y = 18 * settle * motion;
        this.pose.scaleX = 1 + 0.09 * settle * motion;
        this.pose.scaleY = 1 - 0.14 * settle * motion;
        this.pose.rotation = -0.11 * settle * motion;
        this.pose.headRotation = 0.18 * settle * motion;
        this.pose.bodyTint = 0xd4a6a0;
        break;
      }
    }
  }

  private completeAnimation(): void {
    if (this.state === 'surprised') {
      this.activate('scared');
      return;
    }
    if (this.state === 'celebrate') {
      this.duration = Number.POSITIVE_INFINITY;
      this.elapsed = 0;
      this.animation = 'victory-hold';
      this.emitDiagnostics();
      return;
    }
    const next = this.pendingState ?? (this.roundActive ? 'thinking' : 'idle');
    this.activate(next);
  }

  private durationFor(state: CharacterState): number {
    if (state === 'anticipation') return CHARACTER_TIMING.anticipation;
    if (state === 'surprised') return CHARACTER_TIMING.surprise;
    if (state === 'escape') return CHARACTER_TIMING.escape;
    if (state === 'celebrate') return CHARACTER_TIMING.celebration;
    if (state === 'happy') {
      const choice = this.random();
      if (choice < 0.34) return CHARACTER_TIMING.happySmall;
      if (choice < 0.78) return CHARACTER_TIMING.happyMedium;
      return CHARACTER_TIMING.happyBig;
    }
    return Number.POSITIVE_INFINITY;
  }

  private animationFor(state: CharacterState): string {
    if (state !== 'happy') {
      const names: Record<CharacterState, string> = {
        idle: 'breathing',
        anticipation: 'lean-and-bounce',
        thinking: 'board-watch',
        happy: 'happy-medium',
        surprised: 'impact-recoil',
        scared: 'fear-shake',
        celebrate: 'victory-jumps',
        caught: 'defeated-settle',
        escape: 'loot-dash',
      };
      return names[state];
    }
    if (this.duration === CHARACTER_TIMING.happySmall) return 'happy-small';
    if (this.duration === CHARACTER_TIMING.happyBig) return 'happy-big';
    return 'happy-medium';
  }

  private resetMutablePose(): void {
    this.pose.x = BASE_POSE.x;
    this.pose.y = BASE_POSE.y;
    this.pose.scaleX = BASE_POSE.scaleX;
    this.pose.scaleY = BASE_POSE.scaleY;
    this.pose.rotation = BASE_POSE.rotation;
    this.pose.headRotation = BASE_POSE.headRotation;
    this.pose.shadowScale = BASE_POSE.shadowScale;
    this.pose.shadowAlpha = BASE_POSE.shadowAlpha;
    this.pose.coinAlpha = BASE_POSE.coinAlpha;
    this.pose.bodyTint = BASE_POSE.bodyTint;
  }

  private readReducedMotionPreference(): boolean {
    return (
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  private bindReducedMotionPreference(explicitPreference: boolean | undefined): void {
    if (explicitPreference !== undefined || typeof window === 'undefined') return;
    this.mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.mediaQuery.addEventListener('change', this.handleMotionPreference);
  }

  private readonly handleMotionPreference = (event: MediaQueryListEvent): void => {
    this.reducedMotion = event.matches;
    this.emitDiagnostics();
  };

  private emitDiagnostics(): void {
    this.onDiagnostics?.(this.getDiagnostics());
  }
}
