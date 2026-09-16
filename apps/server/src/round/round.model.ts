export interface RoundModel {
  id: string;
  sessionId: string;
  bet: number;
  trapCount: number;
  trapTileIds: Set<number>;
  revealedSafeTiles: Set<number>;
  multiplier: number;
  potentialLoot: number;
  payout: number;
  status: 'active' | 'won' | 'lost';
  createdAt: Date;
  finishedAt?: Date;
}
