const BOARD_TILE_COUNT = 25;
const HOUSE_EDGE = 0.04;
const VALID_TRAP_COUNTS = new Set([1, 3, 5, 7, 10]);

export function calculateSafeProbability(trapCount: number, safeTilesRevealed = 0): number {
  const remainingTiles = BOARD_TILE_COUNT - safeTilesRevealed;
  const safeTiles = BOARD_TILE_COUNT - trapCount - safeTilesRevealed;

  if (!validateTrapCount(trapCount) || safeTilesRevealed < 0 || safeTiles <= 0) {
    return 0;
  }

  return safeTiles / remainingTiles;
}

export function calculateMultiplier(trapCount: number, safeTilesRevealed: number): number {
  if (!validateTrapCount(trapCount) || safeTilesRevealed <= 0) {
    return 1;
  }

  let cumulativeProbability = 1;
  for (let reveal = 0; reveal < safeTilesRevealed; reveal += 1) {
    cumulativeProbability *= calculateSafeProbability(trapCount, reveal);
  }

  return roundToTwoDecimals((1 - HOUSE_EDGE) / cumulativeProbability);
}

export function validateTrapCount(trapCount: number): boolean {
  return Number.isInteger(trapCount) && VALID_TRAP_COUNTS.has(trapCount);
}

export function validateBet(bet: number, availableCredits = Number.POSITIVE_INFINITY): boolean {
  return Number.isFinite(bet) && bet > 0 && bet <= availableCredits;
}

export function calculatePotentialLoot(bet: number, multiplier: number): number {
  if (!validateBet(bet) || !Number.isFinite(multiplier) || multiplier < 1) {
    return 0;
  }

  return roundToTwoDecimals(bet * multiplier);
}

function roundToTwoDecimals(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
