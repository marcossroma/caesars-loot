export type EffectsQuality = 'low' | 'medium' | 'high';
export type ParticlePreset =
  'goldSpark' | 'coinBurst' | 'gemSparkle' | 'smoke' | 'dust' | 'fireEmber';
export type CameraShakePreset = 'small' | 'medium' | 'impact';
export type CameraFlashPreset = 'gold' | 'red' | 'white';

export const EFFECTS_CONFIG = {
  maxParticles: 250,
  qualityMultiplier: { low: 0.4, medium: 0.7, high: 1 },
  particles: {
    goldSpark: { count: 16, lifetime: 620, speed: 0.14, gravity: 0.00012, color: 0xffcf52 },
    coinBurst: { count: 34, lifetime: 920, speed: 0.22, gravity: 0.00028, color: 0xf2a51f },
    gemSparkle: { count: 18, lifetime: 720, speed: 0.12, gravity: 0, color: 0xff304f },
    smoke: { count: 24, lifetime: 850, speed: 0.065, gravity: -0.000035, color: 0x42383a },
    dust: { count: 18, lifetime: 660, speed: 0.09, gravity: -0.000015, color: 0xad8254 },
    fireEmber: { count: 1, lifetime: 1_600, speed: 0.035, gravity: -0.000025, color: 0xff7a1a },
  },
  shake: {
    small: { duration: 150, amplitude: 3 },
    medium: { duration: 230, amplitude: 7 },
    impact: { duration: 320, amplitude: 13 },
  },
  flash: {
    gold: { duration: 180, alpha: 0.2, color: 0xffc84a },
    red: { duration: 230, alpha: 0.3, color: 0xb5151b },
    white: { duration: 120, alpha: 0.2, color: 0xffffff },
  },
  sequence: { hitStop: 55, resultDelay: 220, darkenAlpha: 0.32 },
  adaptiveFpsThreshold: 45,
} as const;

export function selectEffectsQuality(width: number, height: number, cores = 4): EffectsQuality {
  if (width < 500 || height < 500 || cores <= 2) return 'low';
  if (width < 1000 || cores <= 4) return 'medium';
  return 'high';
}

export function lowerQuality(quality: EffectsQuality): EffectsQuality {
  return quality === 'high' ? 'medium' : 'low';
}
