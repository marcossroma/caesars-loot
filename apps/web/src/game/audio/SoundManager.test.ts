import { describe, expect, it, vi } from 'vitest';
import { GameSettingsStore } from '../settings/GameSettingsStore';
import { SoundManager } from './SoundManager';

function fakeAudioContext() {
  const sources: Array<{ stop: ReturnType<typeof vi.fn>; onended: (() => void) | null }> = [];
  const gain = () => ({
    gain: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
      setTargetAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  });
  const context = {
    state: 'running',
    currentTime: 0,
    destination: {},
    createGain: vi.fn(gain),
    createOscillator: vi.fn(() => {
      const source = {
        type: 'sine',
        frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null as (() => void) | null,
      };
      sources.push(source);
      return source;
    }),
    resume: vi.fn(() => Promise.resolve()),
    suspend: vi.fn(() => Promise.resolve()),
    close: vi.fn(() => Promise.resolve()),
  };
  return { context: context as unknown as AudioContext, sources };
}

describe('SoundManager', () => {
  it('unlocks once, rate-limits repeated cues and applies settings', async () => {
    const settings = new GameSettingsStore(null);
    const fake = fakeAudioContext();
    const manager = new SoundManager(settings, () => fake.context);
    expect(await manager.unlock()).toBe(true);
    expect(manager.play('button')).toBe(true);
    expect(manager.play('button')).toBe(false);
    manager.setVolume(0.25);
    expect(manager.getSnapshot().volume).toBe(0.25);
    manager.setMuted(true);
    expect(manager.play('win')).toBe(false);
    expect(manager.getSnapshot().activeVoices).toBe(0);
    manager.destroy();
  });

  it('gives terminal sounds priority over minor active voices', async () => {
    const fake = fakeAudioContext();
    const manager = new SoundManager(new GameSettingsStore(null), () => fake.context);
    await manager.unlock();
    manager.play('coin');
    manager.play('lose');
    expect(fake.sources[0]?.stop).toHaveBeenCalled();
    manager.destroy();
  });
});
