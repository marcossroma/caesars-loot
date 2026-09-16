export interface GameSettings {
  muted: boolean;
  volume: number;
  reducedEffects: boolean;
}

interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const STORAGE_KEY = 'caesars-loot.settings-v1';
const DEFAULT_SETTINGS: GameSettings = { muted: false, volume: 0.7, reducedEffects: false };

const clampVolume = (value: number) =>
  Math.min(1, Math.max(0, Number.isFinite(value) ? value : DEFAULT_SETTINGS.volume));

function browserStorage(): StoragePort | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export class GameSettingsStore {
  private readonly listeners = new Set<() => void>();
  private snapshot: GameSettings;

  constructor(private readonly storage: StoragePort | null = browserStorage()) {
    this.snapshot = this.load();
  }

  getSnapshot = (): GameSettings => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  setMuted(muted: boolean): void {
    this.update({ muted });
  }

  setVolume(volume: number): void {
    this.update({ volume: clampVolume(volume) });
  }

  setReducedEffects(reducedEffects: boolean): void {
    this.update({ reducedEffects });
  }

  private update(values: Partial<GameSettings>): void {
    this.snapshot = { ...this.snapshot, ...values };
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.snapshot));
    } catch {
      // Settings remain usable in memory when storage is blocked or full.
    }
    this.listeners.forEach((listener) => listener());
  }

  private load(): GameSettings {
    try {
      const stored = this.storage?.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<GameSettings>;
        return {
          muted: typeof parsed.muted === 'boolean' ? parsed.muted : DEFAULT_SETTINGS.muted,
          volume: clampVolume(
            typeof parsed.volume === 'number' ? parsed.volume : DEFAULT_SETTINGS.volume,
          ),
          reducedEffects:
            typeof parsed.reducedEffects === 'boolean'
              ? parsed.reducedEffects
              : DEFAULT_SETTINGS.reducedEffects,
        };
      }
      const legacySound = this.storage?.getItem('caesars-loot-sound');
      const legacyEffects = this.storage?.getItem('caesars-loot-reduced-effects');
      return {
        ...DEFAULT_SETTINGS,
        muted: legacySound === 'off',
        reducedEffects: legacyEffects === 'true',
      };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }
}

export const gameSettingsStore = new GameSettingsStore();
