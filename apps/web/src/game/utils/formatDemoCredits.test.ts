import { describe, expect, it } from 'vitest';
import { formatDemoCredits } from './formatDemoCredits';

describe('formatDemoCredits', () => {
  it('formats demo credits without a real currency symbol', () => {
    expect(formatDemoCredits(42.5)).toBe('42.50 credits');
    expect(formatDemoCredits(-4)).toBe('0.00 credits');
  });
});
