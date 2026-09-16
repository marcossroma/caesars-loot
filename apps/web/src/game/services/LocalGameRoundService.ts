import {
  ALLOWED_BETS,
  BOARD_SIZE,
  INITIAL_DEMO_CREDITS,
  TRAP_OPTIONS,
  type CashoutInput,
  type CashoutResult,
  type DemoSession,
  type GameConfig,
  type RevealTileInput,
  type RevealTileResult,
  type RoundHistoryItem,
  type SessionStateResult,
  type StartRoundInput,
  type StartRoundResult,
} from '@caesars-loot/shared';
import { calculateMultiplier, calculatePotentialLoot } from '@caesars-loot/game-math';
import type { GameRoundService } from './GameRoundService';

interface LocalRound {
  id: string;
  sessionId: string;
  bet: number;
  trapCount: number;
  trapIds: Set<number>;
  revealed: Set<number>;
  multiplier: number;
  potentialLoot: number;
  payout: number;
  status: 'active' | 'won' | 'lost';
}

export class LocalGameRoundService implements GameRoundService {
  private sequence = 0;
  private session: DemoSession | null = null;
  private readonly rounds = new Map<string, LocalRound>();

  constructor(private readonly random: () => number = Math.random) {}

  createSession(): Promise<DemoSession> {
    this.sequence += 1;
    this.session = {
      sessionId: `local-session-${this.sequence}`,
      demoCredits: INITIAL_DEMO_CREDITS,
      createdAt: new Date().toISOString(),
    };
    return Promise.resolve(this.session);
  }

  getConfig(): Promise<GameConfig> {
    return Promise.resolve({
      boardSize: BOARD_SIZE,
      allowedBets: ALLOWED_BETS,
      allowedTrapCounts: TRAP_OPTIONS,
      initialDemoCredits: INITIAL_DEMO_CREDITS,
    });
  }

  startRound(input: StartRoundInput): Promise<StartRoundResult> {
    const session = this.requireSession(input.sessionId);
    if (input.bet > session.demoCredits)
      return Promise.reject(new Error('Not enough demo credits.'));
    session.demoCredits -= input.bet;
    const available = Array.from({ length: BOARD_SIZE }, (_, index) => index);
    const traps = new Set<number>();
    while (traps.size < input.trapCount) {
      const selected = Math.min(
        available.length - 1,
        Math.max(0, Math.floor(this.random() * available.length)),
      );
      const [tileId] = available.splice(selected, 1);
      if (tileId !== undefined) traps.add(tileId);
    }
    this.sequence += 1;
    const round: LocalRound = {
      id: `local-round-${this.sequence}`,
      sessionId: session.sessionId,
      bet: input.bet,
      trapCount: input.trapCount,
      trapIds: traps,
      revealed: new Set(),
      multiplier: 1,
      potentialLoot: input.bet,
      payout: 0,
      status: 'active',
    };
    this.rounds.set(round.id, round);
    return Promise.resolve({
      roundId: round.id,
      status: 'active',
      bet: round.bet,
      trapCount: round.trapCount,
      multiplier: 1,
      potentialLoot: round.bet,
      demoCredits: session.demoCredits,
      revealedTiles: [],
    });
  }

  revealTile(input: RevealTileInput): Promise<RevealTileResult> {
    const session = this.requireSession(input.sessionId);
    const round = this.requireRound(input.roundId, session.sessionId);
    if (round.status !== 'active')
      return Promise.reject(new Error('This round has already finished.'));
    if (round.revealed.has(input.tileId))
      return Promise.reject(new Error('This tile was already opened.'));
    if (round.trapIds.has(input.tileId)) {
      round.status = 'lost';
      round.multiplier = 0;
      round.potentialLoot = 0;
      return Promise.resolve({
        roundId: round.id,
        tileId: input.tileId,
        result: 'trap',
        status: 'lost',
        multiplier: 0,
        potentialLoot: 0,
        revealedTiles: [...round.revealed],
        revealedTrapIds: [...round.trapIds],
      });
    }
    round.revealed.add(input.tileId);
    round.multiplier = calculateMultiplier(round.trapCount, round.revealed.size);
    round.potentialLoot = calculatePotentialLoot(round.bet, round.multiplier);
    return Promise.resolve({
      roundId: round.id,
      tileId: input.tileId,
      result: 'safe',
      status: 'active',
      multiplier: round.multiplier,
      potentialLoot: round.potentialLoot,
      revealedTiles: [...round.revealed],
    });
  }

  cashout(input: CashoutInput): Promise<CashoutResult> {
    const session = this.requireSession(input.sessionId);
    const round = this.requireRound(input.roundId, session.sessionId);
    if (round.status !== 'active' || round.revealed.size === 0) {
      return Promise.reject(new Error('Cashout is not available.'));
    }
    round.status = 'won';
    round.payout = round.potentialLoot;
    session.demoCredits += round.payout;
    return Promise.resolve({
      roundId: round.id,
      status: 'won',
      payout: round.payout,
      demoCredits: session.demoCredits,
      multiplier: round.multiplier,
    });
  }

  getHistory(sessionId: string): Promise<RoundHistoryItem[]> {
    this.requireSession(sessionId);
    return Promise.resolve(
      [...this.rounds.values()]
        .filter((round) => round.status !== 'active')
        .slice(-5)
        .reverse()
        .map((round) => ({
          roundId: round.id,
          bet: round.bet,
          trapCount: round.trapCount,
          multiplier: round.multiplier,
          result: round.status === 'won' ? 'won' : 'lost',
          payout: round.payout,
        })),
    );
  }

  getSessionState(sessionId: string): Promise<SessionStateResult> {
    const session = this.requireSession(sessionId);
    const sessionRounds = [...this.rounds.values()].filter(
      (round) => round.sessionId === sessionId,
    );
    const toPublic = (round: LocalRound) => ({
      roundId: round.id,
      status: round.status,
      bet: round.bet,
      trapCount: round.trapCount,
      revealedTiles: [...round.revealed],
      multiplier: round.multiplier,
      potentialLoot: round.potentialLoot,
      payout: round.payout,
      ...(round.status === 'lost' ? { revealedTrapIds: [...round.trapIds] } : {}),
    });
    const activeRound = sessionRounds.find((round) => round.status === 'active');
    const lastCompletedRound = [...sessionRounds]
      .reverse()
      .find((round) => round.status !== 'active');
    return Promise.resolve({
      sessionId,
      demoCredits: session.demoCredits,
      activeRound: activeRound ? toPublic(activeRound) : null,
      lastCompletedRound: lastCompletedRound ? toPublic(lastCompletedRound) : null,
    });
  }

  private requireSession(sessionId: string): DemoSession {
    if (!this.session || this.session.sessionId !== sessionId)
      throw new Error('Session not found.');
    return this.session;
  }

  private requireRound(roundId: string, sessionId: string): LocalRound {
    const round = this.rounds.get(roundId);
    if (!round || round.sessionId !== sessionId) throw new Error('Round not found.');
    return round;
  }
}
