import { Container, type Ticker } from 'pixi.js';
import { describe, expect, it, vi } from 'vitest';
import { CharacterController } from './CharacterController';
import type { CharacterViewPort } from './CharacterView';
import type { CharacterPose, CharacterState } from './characterTypes';

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
class FakeView implements CharacterViewPort {
  readonly root = new Container();
  state: CharacterState = 'idle';
  destroyed = false;
  pose: CharacterPose | null = null;
  setState(state: CharacterState) {
    this.state = state;
  }
  applyPose(pose: CharacterPose) {
    this.pose = { ...pose };
  }
  resetPose() {
    this.pose = null;
  }
  destroy() {
    this.destroyed = true;
    this.root.destroy();
  }
}
function setup(random = () => 0.5) {
  const ticker = new FakeTicker();
  const view = new FakeView();
  const diagnostics = vi.fn();
  const controller = new CharacterController({
    ticker,
    view,
    random,
    reducedMotion: false,
    onDiagnostics: diagnostics,
  });
  return { controller, ticker, view };
}

describe('CharacterController', () => {
  it('supports director-driven anticipation, safe, trap, win and reset reactions', () => {
    const { controller, ticker } = setup();
    controller.setRoundActive(true);
    controller.play('anticipation');
    ticker.advance(450);
    expect(controller.currentState).toBe('thinking');
    controller.play('happy');
    ticker.advance(370);
    expect(controller.currentState).toBe('thinking');
    controller.play('surprised', true);
    ticker.advance(100);
    expect(controller.currentState).toBe('scared');
    controller.play('caught', true);
    expect(controller.currentState).toBe('caught');
    controller.reset();
    expect(controller.currentState).toBe('idle');
    controller.destroy();
  });
  it('lets a high-priority result interrupt a low-priority reaction', () => {
    const { controller } = setup();
    controller.setRoundActive(true);
    controller.play('happy');
    expect(controller.play('thinking')).toBe(false);
    expect(controller.getDiagnostics().queueSize).toBe(1);
    controller.play('celebrate', true);
    expect(controller.currentState).toBe('celebrate');
    controller.destroy();
  });
  it('synchronizes restored authoritative states', () => {
    const { controller } = setup();
    controller.syncGameState('PLAYING');
    expect(controller.currentState).toBe('thinking');
    controller.syncGameState('LOST');
    expect(controller.currentState).toBe('caught');
    controller.syncGameState('READY');
    expect(controller.currentState).toBe('idle');
    controller.syncGameState('WON');
    expect(controller.currentState).toBe('celebrate');
    controller.destroy();
  });
  it('restores baseline and responsive scale without drift', () => {
    const { controller, ticker, view } = setup(() => 0.95);
    controller.resize(390, 844);
    const scale = controller.getDiagnostics().scale;
    controller.play('happy');
    ticker.advance(180);
    expect(view.pose?.y).not.toBe(0);
    controller.reset();
    expect(controller.getDiagnostics().scale).toBe(scale);
    expect(view.root.position.x).toBe(22);
    controller.destroy();
  });
  it('keeps the tablet character compact so the board remains dominant', () => {
    const { controller } = setup();
    controller.resize(768, 1024);
    expect(controller.getDiagnostics().scale).toBe(0.3);
    expect(controller.root.position.x).toBe(30);
    controller.destroy();
  });
  it('owns one ticker and no game event subscriptions', () => {
    const { controller, ticker, view } = setup();
    expect(ticker.callbacks.size).toBe(1);
    controller.destroy();
    expect(ticker.callbacks.size).toBe(0);
    expect(view.destroyed).toBe(true);
  });
  it('reuses one ticker through repeated reaction cycles', () => {
    const { controller, ticker } = setup();
    for (let round = 0; round < 20; round += 1) {
      controller.setRoundActive(true);
      controller.play('happy', true);
      controller.play('celebrate', true);
      controller.reset();
    }
    expect(ticker.callbacks.size).toBe(1);
    controller.destroy();
  });
});
