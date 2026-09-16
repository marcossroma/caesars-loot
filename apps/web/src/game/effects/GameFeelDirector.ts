import type { Ticker } from 'pixi.js';
import type { CharacterPort } from '../character/characterTypes';
import type { GameEventBus } from '../events/GameEventBus';
import type { CameraEffectsManager } from './CameraEffectsManager';
import type { ParticleDiagnostics, ParticleManager } from './ParticleManager';
import type { ParticlePreset } from './effects.config';
import type { SoundCue } from '../audio/SoundManager';

interface DirectorTicker {
  add(callback: (ticker: Ticker) => void): object | void;
  remove(callback: (ticker: Ticker) => void): object | void;
}
export type DevEffect = ParticlePreset | 'safe' | 'trap' | 'win' | 'lose';
export interface EffectDiagnostics extends ParticleDiagnostics {
  cameraState: string;
  scheduledEffects: number;
  listenerCount: number;
}
interface Scheduled {
  remaining: number;
  run: () => void;
}

interface SoundPort {
  play(cue: SoundCue): boolean;
  stopAll(): void;
}

export class GameFeelDirector {
  private readonly disposers: Array<() => void> = [];
  private readonly scheduled: Scheduled[] = [];
  private disposed = false;
  private diagnosticElapsed = 0;
  constructor(
    private readonly events: GameEventBus,
    private readonly ticker: DirectorTicker,
    private readonly particles: ParticleManager,
    private readonly camera: CameraEffectsManager,
    private readonly character: CharacterPort,
    private readonly tilePoint: (id: number) => { x: number; y: number },
    private readonly centrePoint: () => { x: number; y: number },
    private readonly onDiagnostics?: (value: EffectDiagnostics) => void,
    private readonly sound: SoundPort = { play: () => false, stopAll: () => undefined },
  ) {
    this.bind();
    this.ticker.add(this.update);
    this.emit();
  }
  getDiagnostics(): EffectDiagnostics {
    return {
      ...this.particles.getDiagnostics(),
      cameraState: this.camera.currentState,
      scheduledEffects: this.scheduled.length,
      listenerCount: this.disposed ? 0 : this.disposers.length,
    };
  }
  playForDev(effect: DevEffect): void {
    const centre = this.centrePoint();
    if (['goldSpark', 'coinBurst', 'gemSparkle', 'smoke', 'dust', 'fireEmber'].includes(effect))
      this.particles.play(effect as ParticlePreset, centre);
    else if (effect === 'safe') this.safe(12);
    else if (effect === 'trap') this.trap(12);
    else if (effect === 'win') this.win();
    else this.lose();
  }
  stress(count: number): number {
    return this.particles.stress(count, this.centrePoint());
  }
  setReducedMotion(active: boolean): void {
    this.particles.setReducedMotion(active);
    this.camera.setReducedMotion(active);
    this.character.setReducedMotion(active);
    this.emit();
  }
  cancelAll(): void {
    this.scheduled.length = 0;
    this.particles.clear();
    this.camera.reset();
    this.emit();
  }
  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.disposers.splice(0).forEach((dispose) => dispose());
    this.ticker.remove(this.update);
    this.cancelAll();
    this.sound.stopAll();
  }
  private bind(): void {
    this.disposers.push(
      this.events.on('stateChanged', ({ to }) => this.character.syncGameState(to)),
      this.events.on('roundStarted', () => {
        this.camera.setDarkened(false);
        this.character.setRoundActive(true);
      }),
      this.events.on('tileRevealStarted', () => {
        this.sound.play('tilePress');
        this.character.play('thinking');
      }),
      this.events.on('tileRevealed', ({ tileId, result }) =>
        result === 'safe' ? this.safe(tileId) : this.trap(tileId),
      ),
      this.events.on('multiplierUpdated', () => undefined),
      this.events.on('cashoutStarted', () => {
        this.sound.play('cashout');
        this.character.play('escape', true);
        this.particles.play('dust', this.centrePoint());
        this.camera.zoomPunch(0.02);
      }),
      this.events.on('roundFinished', ({ result }) =>
        result === 'won' ? this.win() : this.lose(),
      ),
      this.events.on('roundReset', () => {
        this.sound.stopAll();
        this.cancelAll();
        this.character.reset();
      }),
      this.events.on('error', () => {
        this.sound.stopAll();
        this.cancelAll();
      }),
    );
  }
  private safe(tileId: number): void {
    const point = this.tilePoint(tileId);
    this.character.setRoundActive(true);
    this.character.play('happy');
    this.particles.play('goldSpark', point);
    if (tileId % 5 === 0) this.particles.play('gemSparkle', point);
    this.camera.flash('gold');
    this.camera.shake('small');
    this.sound.play('safeLoot');
    this.sound.play(tileId % 5 === 0 ? 'gem' : 'coin');
    this.sound.play('characterHappy');
    this.emit();
  }
  private trap(tileId: number): void {
    const point = this.tilePoint(tileId);
    this.character.play('surprised', true);
    this.camera.hitStop();
    this.schedule(55, () => {
      this.camera.flash('red');
      this.camera.shake('impact');
      this.particles.play('smoke', point);
      this.particles.play('dust', point);
      this.sound.play('trap');
      this.sound.play('characterScared');
    });
  }
  private win(): void {
    const point = this.centrePoint();
    this.character.setRoundActive(false);
    this.character.play('celebrate', true);
    this.camera.setDarkened(false);
    this.camera.flash('gold');
    this.camera.zoomPunch(0.045, 260);
    this.particles.play('coinBurst', point);
    this.particles.play('goldSpark', point);
    this.sound.play('win');
    this.emit();
  }
  private lose(): void {
    this.sound.play('lose');
    this.character.setRoundActive(false);
    this.character.play('caught', true);
    this.schedule(70, () => this.camera.setDarkened(true));
  }
  private schedule(remaining: number, run: () => void): void {
    this.scheduled.push({ remaining, run });
    this.emit();
  }
  private readonly update = (ticker: Ticker): void => {
    if (this.disposed) return;
    const delta = Math.min(ticker.deltaMS, 50);
    this.diagnosticElapsed += delta;
    let changed = false;
    for (let index = this.scheduled.length - 1; index >= 0; index -= 1) {
      const item = this.scheduled[index]!;
      item.remaining -= delta;
      if (item.remaining <= 0) {
        this.scheduled.splice(index, 1);
        item.run();
        changed = true;
      }
    }
    if (changed || this.diagnosticElapsed >= 250) {
      this.diagnosticElapsed = 0;
      this.emit();
    }
  };
  private emit(): void {
    this.onDiagnostics?.(this.getDiagnostics());
  }
}
