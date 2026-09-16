import { describe, expect, it } from 'vitest';
import { calculateCoverTransform, clampRenderResolution } from './layout';

describe('responsive scene layout', () => {
  it('covers a wide desktop viewport without letterboxing', () => {
    const transform = calculateCoverTransform(1600, 900, 1366, 768);

    expect(transform.scale).toBeCloseTo(0.854, 3);
    expect(transform.x).toBeCloseTo(0, 5);
    expect(transform.y).toBeLessThanOrEqual(0);
  });

  it('centres and crops a wide image for a portrait viewport', () => {
    const transform = calculateCoverTransform(1600, 900, 390, 844);

    expect(transform.scale).toBeCloseTo(0.938, 3);
    expect(transform.x).toBeLessThan(0);
    expect(transform.y).toBeCloseTo(0, 5);
  });

  it('returns a safe transform for an unavailable asset', () => {
    expect(calculateCoverTransform(0, 0, 390, 844)).toEqual({ scale: 1, x: 0, y: 0 });
  });

  it('caps rendering resolution to protect mobile GPU memory', () => {
    expect(clampRenderResolution(0.75)).toBe(1);
    expect(clampRenderResolution(3)).toBe(2);
  });
});
