export type GameErrorCode =
  | 'SESSION_NOT_FOUND'
  | 'ROUND_NOT_FOUND'
  | 'ROUND_ALREADY_ACTIVE'
  | 'ROUND_ALREADY_FINISHED'
  | 'INVALID_TILE'
  | 'TILE_ALREADY_REVEALED'
  | 'INVALID_BET'
  | 'INVALID_TRAP_COUNT'
  | 'INSUFFICIENT_DEMO_CREDITS'
  | 'CASHOUT_NOT_AVAILABLE'
  | 'ROUND_SESSION_MISMATCH';

export class GameDomainError extends Error {
  constructor(
    readonly code: GameErrorCode,
    message: string,
    readonly status: 400 | 404 | 409,
  ) {
    super(message);
  }
}
