import { describe, expect, it } from 'vitest';
import { GameSettingsStore } from './GameSettingsStore';

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe('GameSettingsStore', () => {
  it('persists typed audio and reduced-effects settings', () => {
    const storage = new MemoryStorage();
    const store = new GameSettingsStore(storage);
    store.setMuted(true);
    store.setVolume(0.35);
    store.setReducedEffects(true);
    expect(new GameSettingsStore(storage).getSnapshot()).toEqual({
      muted: true,
      volume: 0.35,
      reducedEffects: true,
    });
  });

  it('clamps volume and survives invalid persisted data', () => {
    const storage = new MemoryStorage();
    storage.setItem('caesars-loot.settings-v1', '{bad json');
    expect(new GameSettingsStore(storage).getSnapshot().volume).toBe(0.7);
    const store = new GameSettingsStore(storage);
    store.setVolume(4);
    expect(store.getSnapshot().volume).toBe(1);
  });

  it('migrates the previous sound and effects preferences', () => {
    const storage = new MemoryStorage();
    storage.setItem('caesars-loot-sound', 'off');
    storage.setItem('caesars-loot-reduced-effects', 'true');
    expect(new GameSettingsStore(storage).getSnapshot()).toMatchObject({
      muted: true,
      reducedEffects: true,
    });
  });
});
