import { gameSettingsStore, type GameSettingsStore } from '../settings/GameSettingsStore';

export type SoundCue =
  | 'button'
  | 'hover'
  | 'tilePress'
  | 'safeLoot'
  | 'coin'
  | 'gem'
  | 'trap'
  | 'cashout'
  | 'win'
  | 'lose'
  | 'characterHappy'
  | 'characterScared';

export interface SoundDiagnostics {
  unlocked: boolean;
  muted: boolean;
  volume: number;
  activeVoices: number;
  attached: boolean;
}

interface Tone {
  frequency: number;
  duration: number;
  offset?: number;
  gain?: number;
  slideTo?: number;
  type?: OscillatorType;
}

interface Voice {
  source: OscillatorNode;
  priority: number;
}

const recipes: Record<SoundCue, readonly Tone[]> = {
  button: [{ frequency: 330, duration: 0.055, gain: 0.1, type: 'triangle' }],
  hover: [{ frequency: 540, duration: 0.035, gain: 0.035, type: 'sine' }],
  tilePress: [{ frequency: 150, slideTo: 105, duration: 0.075, gain: 0.12, type: 'triangle' }],
  safeLoot: [
    { frequency: 523, duration: 0.12, gain: 0.11, type: 'sine' },
    { frequency: 659, duration: 0.16, offset: 0.07, gain: 0.1, type: 'sine' },
  ],
  coin: [{ frequency: 980, slideTo: 1320, duration: 0.11, gain: 0.08, type: 'sine' }],
  gem: [
    { frequency: 784, duration: 0.18, gain: 0.08, type: 'sine' },
    { frequency: 1175, duration: 0.22, offset: 0.04, gain: 0.06, type: 'sine' },
  ],
  trap: [
    { frequency: 115, slideTo: 48, duration: 0.34, gain: 0.19, type: 'sawtooth' },
    { frequency: 63, duration: 0.28, gain: 0.15, type: 'square' },
  ],
  cashout: [
    { frequency: 392, duration: 0.13, gain: 0.1, type: 'triangle' },
    { frequency: 587, duration: 0.2, offset: 0.09, gain: 0.1, type: 'triangle' },
  ],
  win: [
    { frequency: 523, duration: 0.22, gain: 0.12, type: 'triangle' },
    { frequency: 659, duration: 0.24, offset: 0.12, gain: 0.12, type: 'triangle' },
    { frequency: 784, duration: 0.34, offset: 0.24, gain: 0.13, type: 'triangle' },
  ],
  lose: [{ frequency: 220, slideTo: 92, duration: 0.44, gain: 0.15, type: 'sawtooth' }],
  characterHappy: [{ frequency: 700, slideTo: 920, duration: 0.16, gain: 0.055, type: 'sine' }],
  characterScared: [{ frequency: 310, slideTo: 190, duration: 0.22, gain: 0.07, type: 'triangle' }],
};

const priorities: Record<SoundCue, number> = {
  hover: 0,
  button: 0,
  tilePress: 1,
  coin: 1,
  gem: 1,
  safeLoot: 1,
  characterHappy: 1,
  characterScared: 2,
  cashout: 2,
  trap: 3,
  win: 3,
  lose: 3,
};

const rateLimits: Partial<Record<SoundCue, number>> = {
  button: 70,
  hover: 120,
  tilePress: 100,
  coin: 70,
};

export class SoundManager {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly voices = new Set<Voice>();
  private readonly lastPlayed = new Map<SoundCue, number>();
  private readonly listeners = new Set<() => void>();
  private detachUnlock: (() => void) | null = null;
  private readonly detachSettings: () => void;
  private destroyed = false;
  private snapshot: SoundDiagnostics;

  constructor(
    private readonly settings: GameSettingsStore = gameSettingsStore,
    private readonly createContext: () => AudioContext = () => new AudioContext(),
  ) {
    const current = settings.getSnapshot();
    this.snapshot = {
      unlocked: false,
      muted: current.muted,
      volume: current.volume,
      activeVoices: 0,
      attached: false,
    };
    this.detachSettings = settings.subscribe(() => {
      this.applySettings();
      this.emit();
    });
  }

  getSnapshot = (): SoundDiagnostics => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  preload(critical: readonly SoundCue[] = []): Promise<void> {
    void critical;
    return Promise.resolve();
  }

  attach(target: Document = document): () => void {
    if (this.detachUnlock) return this.detachUnlock;
    const unlock = () => void this.unlock();
    target.addEventListener('pointerdown', unlock, { capture: true });
    target.addEventListener('keydown', unlock, { capture: true });
    this.detachUnlock = () => {
      target.removeEventListener('pointerdown', unlock, { capture: true });
      target.removeEventListener('keydown', unlock, { capture: true });
      this.detachUnlock = null;
      this.emit();
    };
    this.emit();
    return this.detachUnlock;
  }

  async unlock(): Promise<boolean> {
    if (this.destroyed) return false;
    if (!this.context) {
      try {
        this.context = this.createContext();
      } catch {
        return false;
      }
      this.master = this.context.createGain();
      this.master.connect(this.context.destination);
      this.applySettings();
    }
    if (this.context.state === 'suspended') await this.context.resume().catch(() => undefined);
    this.emit();
    return this.context.state === 'running';
  }

  play(cue: SoundCue): boolean {
    const settings = this.settings.getSnapshot();
    if (this.destroyed || settings.muted || !this.context || !this.master) return false;
    const nowMs = Date.now();
    const limit = rateLimits[cue] ?? 0;
    if (nowMs - (this.lastPlayed.get(cue) ?? -Infinity) < limit) return false;
    this.lastPlayed.set(cue, nowMs);
    const priority = priorities[cue];
    if (priority >= 3) this.stopVoicesBelow(priority);
    recipes[cue].forEach((tone) => this.startTone(tone, priority));
    this.emit();
    return true;
  }

  setMuted(muted: boolean): void {
    this.settings.setMuted(muted);
    if (muted) this.stopAll();
  }

  setVolume(volume: number): void {
    this.settings.setVolume(volume);
  }

  stopAll(): void {
    [...this.voices].forEach(({ source }) => {
      try {
        source.stop();
      } catch {
        /* Voice already ended. */
      }
    });
    this.voices.clear();
    this.emit();
  }

  suspend(): void {
    this.stopAll();
    void this.context?.suspend().catch(() => undefined);
  }

  resume(): void {
    if (this.context && !this.settings.getSnapshot().muted)
      void this.context.resume().catch(() => undefined);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.detachUnlock?.();
    this.detachSettings();
    this.stopAll();
    void this.context?.close().catch(() => undefined);
    this.context = null;
    this.master = null;
    this.listeners.clear();
  }

  private startTone(tone: Tone, priority: number): void {
    if (!this.context || !this.master) return;
    const source = this.context.createOscillator();
    const envelope = this.context.createGain();
    const start = this.context.currentTime + (tone.offset ?? 0);
    const end = start + tone.duration;
    source.type = tone.type ?? 'sine';
    source.frequency.setValueAtTime(tone.frequency, start);
    if (tone.slideTo) source.frequency.exponentialRampToValueAtTime(tone.slideTo, end);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(tone.gain ?? 0.1, start + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, end);
    source.connect(envelope);
    envelope.connect(this.master);
    const voice = { source, priority };
    this.voices.add(voice);
    source.onended = () => {
      this.voices.delete(voice);
      source.disconnect();
      envelope.disconnect();
      this.emit();
    };
    source.start(start);
    source.stop(end + 0.015);
  }

  private stopVoicesBelow(priority: number): void {
    [...this.voices]
      .filter((voice) => voice.priority < priority)
      .forEach(({ source }) => {
        try {
          source.stop();
        } catch {
          /* Voice already ended. */
        }
      });
  }

  private applySettings(): void {
    if (!this.context || !this.master) return;
    const { muted, volume } = this.settings.getSnapshot();
    this.master.gain.setTargetAtTime(muted ? 0 : volume, this.context.currentTime, 0.015);
  }

  private emit(): void {
    const settings = this.settings.getSnapshot();
    this.snapshot = {
      unlocked: this.context !== null,
      muted: settings.muted,
      volume: settings.volume,
      activeVoices: this.voices.size,
      attached: this.detachUnlock !== null,
    };
    this.listeners.forEach((listener) => listener());
  }
}

export const soundManager = new SoundManager();
