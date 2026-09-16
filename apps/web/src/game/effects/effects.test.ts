import { Container, type Ticker } from 'pixi.js';
import { describe, expect, it, vi } from 'vitest';
import { GameEventBus } from '../events/GameEventBus';
import type { CharacterPort } from '../character/characterTypes';
import { CameraEffectsManager } from './CameraEffectsManager';
import { GameFeelDirector } from './GameFeelDirector';
import { ParticleManager } from './ParticleManager';
import { selectEffectsQuality } from './effects.config';

class FakeTicker {
  readonly callbacks = new Set<(ticker: Ticker) => void>();
  add(callback: (ticker: Ticker) => void) {
    this.callbacks.add(callback);
  }
  remove(callback: (ticker: Ticker) => void) {
    this.callbacks.delete(callback);
  }
  tick(deltaMS: number) {
    this.callbacks.forEach((callback) => callback({ deltaMS } as Ticker));
  }
  advance(ms: number) {
    for (let elapsed = 0; elapsed < ms; elapsed += 25) this.tick(25);
  }
}
function particles(quality: 'low' | 'medium' | 'high' = 'high', reducedMotion = false) {
  const ticker = new FakeTicker();
  const effectsRoot = new Container();
  const ambientRoot = new Container();
  const manager = new ParticleManager({ ticker, effectsRoot, ambientRoot, quality, reducedMotion });
  return { ticker, manager, effectsRoot, ambientRoot };
}

describe('effects configuration and pooling', () => {
  it('selects lower quality for constrained viewports and hardware', () => {
    expect(selectEffectsQuality(390, 844, 8)).toBe('low');
    expect(selectEffectsQuality(900, 700, 4)).toBe('medium');
    expect(selectEffectsQuality(1440, 900, 8)).toBe('high');
  });
  it('preallocates one fixed pool and never exceeds its maximum', () => {
    const { manager } = particles();
    expect(manager.getDiagnostics().poolSize).toBe(250);
    expect(manager.getDiagnostics()).toMatchObject({
      createdParticles: 250,
      activeParticles: 0,
      availableParticles: 250,
      peakActiveParticles: 0,
    });
    expect(manager.stress(500, { x: 10, y: 10 })).toBe(250);
    expect(manager.getDiagnostics().activeParticles).toBe(250);
    expect(manager.getDiagnostics()).toMatchObject({
      availableParticles: 0,
      peakActiveParticles: 250,
    });
    expect(manager.play('goldSpark', { x: 10, y: 10 })).toBe(0);
    expect(manager.stress(100, { x: 10, y: 10 })).toBe(100);
    expect(manager.stress(0, { x: 10, y: 10 })).toBe(0);
    manager.destroy();
    expect(manager.getDiagnostics().tickerCallbacks).toBe(0);
  });
  it('scales emission by quality, returns particles, and supports reduced motion', () => {
    const low = particles('low');
    const high = particles('high');
    const reduced = particles('high', true);
    expect(low.manager.play('coinBurst', { x: 0, y: 0 })).toBeLessThan(
      high.manager.play('coinBurst', { x: 0, y: 0 }),
    );
    expect(reduced.manager.play('coinBurst', { x: 0, y: 0 })).toBeLessThan(
      low.manager.play('coinBurst', { x: 0, y: 0 }),
    );
    high.ticker.advance(2_000);
    expect(high.manager.getDiagnostics().activeParticles).toBeLessThan(8);
    low.manager.destroy();
    high.manager.destroy();
    reduced.manager.destroy();
  });
});

describe('camera and game feel lifecycle', () => {
  it('routes gameplay events through the director sound port', () => {
    const ticker = new FakeTicker();
    const { manager: particleManager } = particles();
    const camera = new CameraEffectsManager(ticker, new Container(), new Container());
    const character = {
      play: vi.fn(() => true),
      playForDev: vi.fn(),
      syncGameState: vi.fn(),
      setRoundActive: vi.fn(),
      setReducedMotion: vi.fn(),
      reset: vi.fn(),
      getDiagnostics: vi.fn(),
    } as unknown as CharacterPort;
    const played: string[] = [];
    const sound = {
      play: vi.fn((cue: string) => {
        played.push(cue);
        return true;
      }),
      stopAll: vi.fn(),
    };
    const events = new GameEventBus();
    const director = new GameFeelDirector(
      events,
      ticker,
      particleManager,
      camera,
      character,
      () => ({ x: 10, y: 10 }),
      () => ({ x: 20, y: 20 }),
      undefined,
      sound,
    );
    events.emit('tileRevealStarted', { tileId: 1 });
    events.emit('tileRevealed', { tileId: 1, result: 'safe' });
    events.emit('roundFinished', { result: 'won', payout: 10 });
    expect(played).toEqual(['tilePress', 'safeLoot', 'coin', 'characterHappy', 'win']);
    director.destroy();
    expect(sound.stopAll).toHaveBeenCalled();
    camera.destroy();
    particleManager.destroy();
  });
  it('always restores the camera baseline and removes its ticker', () => {
    const ticker = new FakeTicker();
    const camera = new Container();
    const overlay = new Container();
    const manager = new CameraEffectsManager(ticker, camera, overlay);
    manager.resize(800, 600);
    manager.shake('impact');
    manager.zoomPunch();
    ticker.advance(600);
    expect(camera.x).toBe(400);
    expect(camera.y).toBe(300);
    expect(camera.scale.x).toBe(1);
    manager.reset();
    expect(manager.currentState).toBe('idle');
    manager.destroy();
    expect(ticker.callbacks.size).toBe(0);
  });
  it('reduces movement when motion reduction is enabled', () => {
    const ticker = new FakeTicker();
    const camera = new Container();
    const manager = new CameraEffectsManager(ticker, camera, new Container(), true);
    manager.resize(390, 844);
    manager.zoomPunch();
    expect(manager.currentState).toBe('idle');
    manager.shake('impact');
    ticker.tick(25);
    expect(Math.abs(camera.x - 195)).toBeLessThan(2);
    manager.destroy();
  });
  it('cancels scheduled work and unsubscribes all events on dispose', () => {
    const ticker = new FakeTicker();
    const { manager: particleManager } = particles();
    const camera = new CameraEffectsManager(ticker, new Container(), new Container());
    camera.resize(800, 600);
    const character = {
      play: vi.fn(() => true),
      playForDev: vi.fn(),
      syncGameState: vi.fn(),
      setRoundActive: vi.fn(),
      setReducedMotion: vi.fn(),
      reset: vi.fn(),
      getDiagnostics: vi.fn(),
    } as unknown as CharacterPort;
    const events = new GameEventBus();
    const director = new GameFeelDirector(
      events,
      ticker,
      particleManager,
      camera,
      character,
      () => ({ x: 100, y: 100 }),
      () => ({ x: 400, y: 300 }),
    );
    events.emit('tileRevealed', { tileId: 1, result: 'trap' });
    expect(director.getDiagnostics().scheduledEffects).toBe(1);
    director.cancelAll();
    expect(director.getDiagnostics().scheduledEffects).toBe(0);
    expect(director.getDiagnostics().activeParticles).toBe(0);
    director.destroy();
    expect(director.getDiagnostics().listenerCount).toBe(0);
    camera.destroy();
    particleManager.destroy();
  });
  it('keeps resource counts stable through twenty complete presentation cycles', () => {
    const ticker = new FakeTicker();
    const particleRoot = new Container();
    const ambientRoot = new Container();
    const particleManager = new ParticleManager({
      ticker,
      effectsRoot: particleRoot,
      ambientRoot,
      quality: 'high',
    });
    const camera = new CameraEffectsManager(ticker, new Container(), new Container());
    camera.resize(800, 600);
    const character = {
      play: vi.fn(() => true),
      playForDev: vi.fn(),
      syncGameState: vi.fn(),
      setRoundActive: vi.fn(),
      setReducedMotion: vi.fn(),
      reset: vi.fn(),
      getDiagnostics: vi.fn(),
    } as unknown as CharacterPort;
    const events = new GameEventBus();
    const director = new GameFeelDirector(
      events,
      ticker,
      particleManager,
      camera,
      character,
      () => ({ x: 100, y: 100 }),
      () => ({ x: 400, y: 300 }),
    );
    for (let round = 0; round < 20; round += 1) {
      events.emit('roundStarted', { roundId: String(round), bet: 5, traps: 3 });
      events.emit('tileRevealed', { tileId: round % 25, result: 'safe' });
      events.emit('roundFinished', { result: 'won', payout: 5.45 });
      events.emit('roundReset', {});
    }
    expect(director.getDiagnostics()).toMatchObject({
      activeParticles: 0,
      poolSize: 250,
      listenerCount: 9,
      tickerCallbacks: 1,
    });
    expect(ticker.callbacks.size).toBe(3);
    director.destroy();
    camera.destroy();
    particleManager.destroy();
    expect(ticker.callbacks.size).toBe(0);
  });
});
