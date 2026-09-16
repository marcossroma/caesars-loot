import { describe, expect, it } from 'vitest';
import { generateTrapIds } from './trap-generator.js';
import { DeterministicRandomSource } from './random-source.js';

describe('generateTrapIds', () => {
  it.each([1, 3, 5, 7, 10])('creates %i unique in-range traps', (count) => {
    const traps = generateTrapIds(count, () => 0);
    expect(traps.size).toBe(count);
    expect([...traps]).toEqual(Array.from({ length: count }, (_, index) => index));
    expect([...traps].every((tileId) => tileId >= 0 && tileId < 25)).toBe(true);
  });

  it('rejects unsupported counts and invalid random sources', () => {
    expect(() => generateTrapIds(2, () => 0)).toThrow('Unsupported');
    expect(() => generateTrapIds(3, () => -1)).toThrow('invalid value');
  });

  it.each([1, 3, 5, 7, 10])(
    'keeps %i generated traps unique and in range across many deterministic rounds',
    (count) => {
      for (let round = 0; round < 100; round += 1) {
        const source = new DeterministicRandomSource([round, 24, 7, 19, 3]);
        const traps = [...generateTrapIds(count, source)];
        expect(new Set(traps).size).toBe(count);
        expect(traps.every((tileId) => tileId >= 0 && tileId < 25)).toBe(true);
      }
    },
  );

  it('provides a repeatable deterministic random source for tests', () => {
    const first = new DeterministicRandomSource([9, 2, 14]);
    const second = new DeterministicRandomSource([9, 2, 14]);
    expect(Array.from({ length: 8 }, () => first.nextInt(7))).toEqual(
      Array.from({ length: 8 }, () => second.nextInt(7)),
    );
  });
});
