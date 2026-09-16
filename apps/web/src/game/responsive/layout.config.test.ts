import { describe, expect, it } from 'vitest';
import { calculateResponsiveLayout, LAYOUT_CONFIG } from './layout.config';

describe('responsive layout configuration', () => {
  it.each([
    [360, 800, 'mobile'],
    [390, 844, 'mobile'],
    [768, 1024, 'tablet'],
    [1366, 768, 'desktop'],
    [1920, 1080, 'wide'],
    [844, 390, 'compact-landscape'],
  ] as const)('classifies %ix%i as %s', (width, height, mode) => {
    const layout = calculateResponsiveLayout(width, height);
    expect(layout.mode).toBe(mode);
    expect(layout.boardMaxSize).toBe(LAYOUT_CONFIG.board.max);
  });

  it('prioritizes low effects and board space on phones', () => {
    const phone = calculateResponsiveLayout(390, 844);
    expect(phone.effectsQuality).toBe('low');
    expect(phone.characterScale).toBeLessThan(0.2);
    expect(phone.rightReserve).toBe(0);
  });

  it('reserves a side control rail in short landscape viewports', () => {
    const landscape = calculateResponsiveLayout(844, 390);
    expect(landscape.rightReserve).toBeGreaterThanOrEqual(228);
    expect(landscape.bottomReserve).toBeLessThan(24);
  });
});
