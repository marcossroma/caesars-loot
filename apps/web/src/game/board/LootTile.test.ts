import { describe, expect, it, vi } from 'vitest';
import type { FederatedPointerEvent } from 'pixi.js';
import type { TweenManager } from '../animation/TweenManager';
import { LootTile } from './LootTile';

const pointer = (pointerId: number, isPrimary = true) =>
  ({
    pointerId,
    isPrimary,
    button: 0,
    stopPropagation: vi.fn(),
  }) as unknown as FederatedPointerEvent;

describe('LootTile touch input', () => {
  it('accepts one primary pointer sequence and ignores secondary or duplicate taps', () => {
    const onSelect = vi.fn();
    const tweenManager = {
      to: vi.fn((options: Parameters<TweenManager['to']>[0]) => {
        options.onUpdate(options.to);
        options.onComplete?.();
      }),
      cancel: vi.fn(),
    } as unknown as TweenManager;
    const tile = new LootTile({
      id: 0,
      row: 0,
      column: 0,
      tweenManager,
      onHover: vi.fn(),
      onSelect,
    });

    tile.container.emit('pointerdown', pointer(2, false));
    tile.container.emit('pointertap', pointer(2, false));
    tile.container.emit('pointerdown', pointer(1));
    tile.container.emit('pointerdown', pointer(2, false));
    tile.container.emit('pointertap', pointer(2));
    tile.container.emit('pointerup', pointer(1));
    tile.container.emit('pointertap', pointer(1));
    tile.container.emit('pointertap', pointer(1));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(tile);
    tile.destroy();
  });
});
