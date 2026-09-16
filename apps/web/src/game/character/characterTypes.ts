export type CharacterState =
  | 'idle'
  | 'anticipation'
  | 'thinking'
  | 'happy'
  | 'surprised'
  | 'scared'
  | 'celebrate'
  | 'caught'
  | 'escape';

export interface CharacterPose {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  headRotation: number;
  shadowScale: number;
  shadowAlpha: number;
  coinAlpha: number;
  bodyTint: number;
}

export interface CharacterDiagnostics {
  state: CharacterState;
  animation: string;
  queueSize: number;
  scale: number;
  tickerCallbacks: number;
  reducedMotion: boolean;
}

export interface CharacterPort {
  play(state: CharacterState, force?: boolean): boolean;
  playForDev(state: CharacterState): void;
  syncGameState(gameState: string): void;
  setRoundActive(active: boolean): void;
  setReducedMotion(active: boolean): void;
  reset(): void;
  getDiagnostics(): CharacterDiagnostics;
}

export const CHARACTER_PRIORITIES: Record<CharacterState, number> = {
  idle: 0,
  thinking: 1,
  anticipation: 2,
  happy: 2,
  surprised: 3,
  escape: 3,
  scared: 4,
  celebrate: 5,
  caught: 5,
};

export const CHARACTER_TIMING = {
  anticipation: 440,
  happySmall: 280,
  happyMedium: 360,
  happyBig: 440,
  surprise: 90,
  escape: 520,
  celebration: 1_300,
  idleBreath: 2_800,
  thinkingSway: 1_900,
  reducedMotionFactor: 0.55,
} as const;

export const CHARACTER_EASING = {
  outCubic: (progress: number) => 1 - (1 - progress) ** 3,
  inOutSine: (progress: number) => -(Math.cos(Math.PI * progress) - 1) / 2,
  outBack: (progress: number) => {
    const overshoot = 1.70158;
    return 1 + (overshoot + 1) * (progress - 1) ** 3 + overshoot * (progress - 1) ** 2;
  },
} as const;
