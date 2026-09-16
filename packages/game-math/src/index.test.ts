import { describe, expect, it } from 'vitest';
import {
  calculateMultiplier,
  calculatePotentialLoot,
  calculateSafeProbability,
  validateBet,
  validateTrapCount,
} from './index';

describe('game math', () => {
  it.each([1, 3, 5, 7, 10])('accepts supported trap count %i', (trapCount) => {
    expect(validateTrapCount(trapCount)).toBe(true);
  });

  it.each([0, 2, 4, 11, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects unsupported trap count %s',
    (trapCount) => {
      expect(validateTrapCount(trapCount)).toBe(false);
    },
  );

  it('calculates the first-pick safe probability', () => {
    expect(calculateSafeProbability(5)).toBe(0.8);
  });

  it('increases the multiplier as safe tiles are revealed', () => {
    expect(calculateMultiplier(3, 2)).toBeGreaterThan(calculateMultiplier(3, 1));
  });

  it('accepts only supported trap counts', () => {
    expect(validateTrapCount(7)).toBe(true);
    expect(validateTrapCount(2)).toBe(false);
  });

  it('validates demo bets against available credits', () => {
    expect(validateBet(5, 100)).toBe(true);
    expect(validateBet(101, 100)).toBe(false);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 100.01])(
    'rejects invalid or unaffordable bet %s',
    (bet) => {
      expect(validateBet(bet, 100)).toBe(false);
    },
  );

  it('calculates potential demo loot using two decimal places', () => {
    expect(calculatePotentialLoot(5, 2.42)).toBe(12.1);
  });

  it('never returns negative multipliers or payouts for invalid values', () => {
    expect(calculateMultiplier(2, -1)).toBe(1);
    expect(calculatePotentialLoot(-5, 2)).toBe(0);
    expect(calculatePotentialLoot(5, -2)).toBe(0);
  });

  it('makes higher trap counts progress faster after a safe reveal', () => {
    expect(calculateMultiplier(10, 2)).toBeGreaterThan(calculateMultiplier(3, 2));
  });

  it('keeps probability, multiplier and potential loot finite across the supported matrix', () => {
    for (const traps of [1, 3, 5, 7, 10]) {
      for (let reveals = 0; reveals < 25 - traps; reveals += 1) {
        const probability = calculateSafeProbability(traps, reveals);
        const multiplier = calculateMultiplier(traps, reveals);
        const loot = calculatePotentialLoot(100, multiplier);
        expect(probability).toBeGreaterThan(0);
        expect(probability).toBeLessThanOrEqual(1);
        expect(Number.isFinite(multiplier)).toBe(true);
        expect(Number.isFinite(loot)).toBe(true);
        expect(Number((loot * 100).toFixed(8)) % 1).toBe(0);
      }
    }
  });

  it('rounds common floating-point boundaries to two decimal places', () => {
    expect(calculatePotentialLoot(0.1, 1.15)).toBe(0.12);
    expect(calculatePotentialLoot(1.005, 1)).toBe(1.01);
  });
});
