import { describe, expect, it } from 'vitest';
import { GameStateMachine } from './GameStateMachine';

describe('GameStateMachine', () => {
  it('follows the playable lifecycle', () => {
    const machine = new GameStateMachine();
    for (const state of [
      'LOADING',
      'READY',
      'STARTING',
      'PLAYING',
      'REVEALING',
      'PLAYING',
      'CASHING_OUT',
      'WON',
      'READY',
    ] as const) {
      machine.transition(state);
    }
    expect(machine.state).toBe('READY');
  });

  it('rejects invalid transitions', () => {
    const machine = new GameStateMachine('READY');
    expect(() => machine.transition('WON')).toThrow('READY -> WON');
  });

  it.each([
    ['READY', 'LOST'],
    ['LOST', 'PLAYING'],
    ['WON', 'REVEALING'],
    ['CASHING_OUT', 'PLAYING'],
    ['BOOT', 'WON'],
  ] as const)('rejects impossible transition %s → %s', (from, to) => {
    const machine = new GameStateMachine(from);
    expect(machine.canTransition(to)).toBe(false);
    expect(() => machine.transition(to)).toThrow(`${from} -> ${to}`);
    expect(machine.state).toBe(from);
  });

  it('covers the complete reveal-to-loss path', () => {
    const machine = new GameStateMachine('PLAYING');
    machine.transition('REVEALING');
    machine.transition('LOST');
    machine.transition('READY');
    expect(machine.state).toBe('READY');
  });

  it('supports loss and error recovery', () => {
    const loss = new GameStateMachine('REVEALING');
    loss.transition('LOST');
    loss.transition('READY');
    expect(loss.state).toBe('READY');

    const error = new GameStateMachine('PLAYING');
    error.transition('ERROR');
    error.transition('READY');
    expect(error.state).toBe('READY');
  });
});
