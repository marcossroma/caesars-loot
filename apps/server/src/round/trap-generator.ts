import { BOARD_SIZE, TRAP_OPTIONS } from '@caesars-loot/shared';
import { CryptoRandomSource, type RandomSource } from './random-source.js';

export type RandomIndex = (maxExclusive: number) => number;

export function generateTrapIds(
  trapCount: number,
  random: RandomSource | RandomIndex = new CryptoRandomSource(),
): Set<number> {
  if (!(TRAP_OPTIONS as readonly number[]).includes(trapCount)) {
    throw new Error('Unsupported trap count.');
  }
  const available = Array.from({ length: BOARD_SIZE }, (_, index) => index);
  const traps = new Set<number>();
  while (traps.size < trapCount) {
    const selectedIndex =
      typeof random === 'function' ? random(available.length) : random.nextInt(available.length);
    if (
      !Number.isInteger(selectedIndex) ||
      selectedIndex < 0 ||
      selectedIndex >= available.length
    ) {
      throw new Error('Random index source returned an invalid value.');
    }
    const [tileId] = available.splice(selectedIndex, 1);
    if (tileId !== undefined) traps.add(tileId);
  }
  return traps;
}
