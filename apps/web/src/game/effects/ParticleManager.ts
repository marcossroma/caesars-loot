import { Graphics, type Container, type Ticker } from 'pixi.js';
import {
  EFFECTS_CONFIG,
  lowerQuality,
  type EffectsQuality,
  type ParticlePreset,
} from './effects.config';

interface ParticleTicker {
  add(callback: (ticker: Ticker) => void): object | void;
  remove(callback: (ticker: Ticker) => void): object | void;
}
interface Particle {
  view: Graphics;
  active: boolean;
  ambient: boolean;
  age: number;
  life: number;
  vx: number;
  vy: number;
  gravity: number;
  spin: number;
}
export interface ParticleDiagnostics {
  fps: number;
  fpsAverage5s: number;
  fpsMinimum: number;
  frameTimeMs: number;
  activeParticles: number;
  poolSize: number;
  createdParticles: number;
  availableParticles: number;
  peakActiveParticles: number;
  maxParticles: number;
  quality: EffectsQuality;
  tickerCallbacks: number;
  reducedMotion: boolean;
}

export class ParticleManager {
  private readonly particles: Particle[] = [];
  private readonly ticker: ParticleTicker;
  private readonly effectsRoot: Container;
  private readonly ambientRoot: Container;
  private quality: EffectsQuality;
  private reducedMotion: boolean;
  private disposed = false;
  private ambientElapsed = 0;
  private diagnosticElapsed = 0;
  private sampledElapsed = 0;
  private sampledFrames = 0;
  private fps = 60;
  private frameTimeMs = 1000 / 60;
  private readonly fpsSamples: number[] = [];
  private fpsMinimum = Number.POSITIVE_INFINITY;
  private activeParticles = 0;
  private peakActiveParticles = 0;
  private readonly createdParticles: number;
  private adaptiveCooldown = 0;

  constructor(options: {
    ticker: ParticleTicker;
    effectsRoot: Container;
    ambientRoot: Container;
    quality: EffectsQuality;
    reducedMotion?: boolean;
    onDiagnostics?: (value: ParticleDiagnostics) => void;
  }) {
    this.ticker = options.ticker;
    this.effectsRoot = options.effectsRoot;
    this.ambientRoot = options.ambientRoot;
    this.quality = options.quality;
    this.reducedMotion = options.reducedMotion ?? false;
    this.onDiagnostics = options.onDiagnostics;
    for (let index = 0; index < EFFECTS_CONFIG.maxParticles; index += 1) {
      const view = new Graphics({ label: `pooled-particle-${index}` });
      view.visible = false;
      this.effectsRoot.addChild(view);
      this.particles.push({
        view,
        active: false,
        ambient: false,
        age: 0,
        life: 1,
        vx: 0,
        vy: 0,
        gravity: 0,
        spin: 0,
      });
    }
    this.createdParticles = this.particles.length;
    this.ticker.add(this.update);
  }
  private readonly onDiagnostics: ((value: ParticleDiagnostics) => void) | undefined;
  getDiagnostics(): ParticleDiagnostics {
    return {
      fps: Math.round(this.fps),
      fpsAverage5s: Math.round(
        this.fpsSamples.reduce((sum, sample) => sum + sample, 0) /
          Math.max(1, this.fpsSamples.length),
      ),
      fpsMinimum: Math.round(Number.isFinite(this.fpsMinimum) ? this.fpsMinimum : this.fps),
      frameTimeMs: Number(this.frameTimeMs.toFixed(2)),
      activeParticles: this.activeParticles,
      poolSize: this.particles.length,
      createdParticles: this.createdParticles,
      availableParticles: Math.max(0, this.particles.length - this.activeParticles),
      peakActiveParticles: this.peakActiveParticles,
      maxParticles: EFFECTS_CONFIG.maxParticles,
      quality: this.quality,
      tickerCallbacks: this.disposed ? 0 : 1,
      reducedMotion: this.reducedMotion,
    };
  }
  setQuality(value: EffectsQuality): void {
    this.quality = this.reducedMotion ? 'low' : value;
    this.emit();
  }
  setReducedMotion(value: boolean): void {
    this.reducedMotion = value;
    if (value) this.quality = 'low';
    this.emit();
  }
  play(
    preset: ParticlePreset,
    point: { x: number; y: number },
    requestedCount?: number,
    exactCount = false,
  ): number {
    if (this.disposed) return 0;
    const config = EFFECTS_CONFIG.particles[preset];
    const multiplier = exactCount
      ? 1
      : this.reducedMotion
        ? 0.25
        : EFFECTS_CONFIG.qualityMultiplier[this.quality];
    const count = Math.max(1, Math.round((requestedCount ?? config.count) * multiplier));
    let spawned = 0;
    for (const particle of this.particles) {
      if (spawned >= count) break;
      if (particle.active) continue;
      const angle = (spawned / Math.max(count, 1)) * Math.PI * 2 + (spawned % 4) * 0.17;
      const speed = config.speed * (0.65 + (spawned % 5) * 0.11);
      particle.active = true;
      this.activeParticles += 1;
      this.peakActiveParticles = Math.max(this.peakActiveParticles, this.activeParticles);
      particle.ambient = preset === 'fireEmber';
      particle.age = 0;
      particle.life = config.lifetime * (0.8 + (spawned % 4) * 0.1);
      particle.vx = Math.cos(angle) * speed;
      particle.vy = Math.sin(angle) * speed - (preset === 'coinBurst' ? 0.11 : 0.025);
      particle.gravity = config.gravity;
      particle.spin = (spawned % 2 ? 1 : -1) * 0.004;
      if (particle.ambient) this.ambientRoot.addChild(particle.view);
      else this.effectsRoot.addChild(particle.view);
      particle.view.clear();
      this.drawParticle(particle.view, preset, config.color);
      particle.view.position.set(point.x, point.y);
      particle.view.rotation = angle;
      particle.view.alpha = 1;
      particle.view.scale.set(1);
      particle.view.visible = true;
      spawned += 1;
    }
    this.emit();
    return spawned;
  }
  stress(count: number, point: { x: number; y: number }): number {
    this.clear();
    if (count <= 0) return 0;
    return this.play('goldSpark', point, Math.min(count, 500), true);
  }
  clear(): void {
    for (const particle of this.particles) this.release(particle);
    this.emit();
  }
  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.ticker.remove(this.update);
    this.clear();
    for (const particle of this.particles) particle.view.destroy();
    this.particles.length = 0;
    this.emit();
  }
  private drawParticle(view: Graphics, preset: ParticlePreset, color: number): void {
    if (preset === 'coinBurst')
      view.circle(0, 0, 5).fill(color).stroke({ color: 0xffe291, width: 1 });
    else if (preset === 'gemSparkle')
      view.moveTo(0, -7).lineTo(5, 0).lineTo(0, 7).lineTo(-5, 0).closePath().fill(color);
    else if (preset === 'smoke' || preset === 'dust')
      view.circle(0, 0, preset === 'smoke' ? 10 : 6).fill({ color, alpha: 0.58 });
    else view.circle(0, 0, preset === 'fireEmber' ? 2 : 3).fill(color);
  }
  private readonly update = (ticker: Ticker): void => {
    if (this.disposed) return;
    const delta = Math.min(ticker.deltaMS, 50);
    this.sampledElapsed += delta;
    this.sampledFrames += 1;
    this.diagnosticElapsed += delta;
    this.ambientElapsed += delta;
    this.adaptiveCooldown = Math.max(0, this.adaptiveCooldown - delta);
    for (const particle of this.particles) {
      if (!particle.active) continue;
      particle.age += delta;
      particle.vy += particle.gravity * delta;
      particle.view.x += particle.vx * delta;
      particle.view.y += particle.vy * delta;
      particle.view.rotation += particle.spin * delta;
      particle.view.alpha = Math.max(0, 1 - particle.age / particle.life);
      if (particle.ambient) particle.view.scale.set(1 + particle.age / particle.life);
      if (particle.age >= particle.life) this.release(particle);
    }
    if (this.ambientElapsed >= (this.quality === 'high' ? 180 : 360)) {
      this.ambientElapsed = 0;
      this.play('fireEmber', { x: 24 + Math.random() * 90, y: 280 + Math.random() * 260 });
    }
    if (this.sampledElapsed >= 1_000) {
      this.fps = (this.sampledFrames * 1_000) / this.sampledElapsed;
      this.frameTimeMs = this.sampledElapsed / Math.max(1, this.sampledFrames);
      this.fpsSamples.push(this.fps);
      if (this.fpsSamples.length > 5) this.fpsSamples.shift();
      this.fpsMinimum = Math.min(this.fpsMinimum, this.fps);
      this.sampledElapsed = 0;
      this.sampledFrames = 0;
      if (
        !this.reducedMotion &&
        this.fps < EFFECTS_CONFIG.adaptiveFpsThreshold &&
        this.quality !== 'low' &&
        this.adaptiveCooldown === 0
      ) {
        this.quality = lowerQuality(this.quality);
        this.adaptiveCooldown = 10_000;
      }
    }
    if (this.diagnosticElapsed >= 250) {
      this.diagnosticElapsed = 0;
      this.emit();
    }
  };
  private release(particle: Particle): void {
    if (!particle.active) return;
    particle.active = false;
    this.activeParticles = Math.max(0, this.activeParticles - 1);
    particle.view.visible = false;
    particle.view.alpha = 0;
  }
  private emit(): void {
    this.onDiagnostics?.(this.getDiagnostics());
  }
}
