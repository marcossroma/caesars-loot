import { randomInt } from 'node:crypto';

export interface RandomSource {
  nextInt(maxExclusive: number): number;
}

export class CryptoRandomSource implements RandomSource {
  nextInt(maxExclusive: number): number {
    return randomInt(maxExclusive);
  }
}

export class DeterministicRandomSource implements RandomSource {
  private cursor = 0;

  constructor(private readonly sequence: readonly number[]) {
    if (sequence.length === 0 || sequence.some((value) => !Number.isInteger(value) || value < 0)) {
      throw new Error('Deterministic random sequence must contain non-negative integers.');
    }
  }

  nextInt(maxExclusive: number): number {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new Error('Random upper bound must be a positive integer.');
    }
    const value = this.sequence[this.cursor % this.sequence.length]!;
    this.cursor += 1;
    return value % maxExclusive;
  }
}
