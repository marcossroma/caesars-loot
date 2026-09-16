export const GAME_STATES = [
  'BOOT',
  'LOADING',
  'READY',
  'STARTING',
  'PLAYING',
  'REVEALING',
  'CASHING_OUT',
  'WON',
  'LOST',
  'ERROR',
] as const;

export type GameState = (typeof GAME_STATES)[number];

const TRANSITIONS: Record<GameState, ReadonlySet<GameState>> = {
  BOOT: new Set(['LOADING', 'ERROR']),
  LOADING: new Set(['READY', 'ERROR']),
  READY: new Set(['STARTING', 'ERROR']),
  STARTING: new Set(['PLAYING', 'READY', 'ERROR']),
  PLAYING: new Set(['REVEALING', 'CASHING_OUT', 'ERROR']),
  REVEALING: new Set(['PLAYING', 'WON', 'LOST', 'ERROR']),
  CASHING_OUT: new Set(['WON', 'ERROR']),
  WON: new Set(['READY', 'ERROR']),
  LOST: new Set(['READY', 'ERROR']),
  ERROR: new Set(['READY', 'LOADING']),
};

export class GameStateMachine {
  constructor(private value: GameState = 'BOOT') {}

  get state(): GameState {
    return this.value;
  }

  canTransition(next: GameState): boolean {
    return next === this.value || TRANSITIONS[this.value].has(next);
  }

  transition(next: GameState): void {
    if (next === this.value) return;
    if (!this.canTransition(next)) {
      throw new Error(`Invalid game transition: ${this.value} -> ${next}`);
    }
    this.value = next;
  }

  restore(next: GameState): void {
    this.value = next;
  }
}
