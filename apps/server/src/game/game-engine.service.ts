import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  ALLOWED_BETS,
  BOARD_SIZE,
  INITIAL_DEMO_CREDITS,
  TRAP_OPTIONS,
  type CashoutInput,
  type CashoutResult,
  type GameConfig,
  type RevealTileInput,
  type RevealTileResult,
  type RoundHistoryItem,
  type SessionStateResult,
  type StartRoundInput,
  type StartRoundResult,
} from '@caesars-loot/shared';
import { calculateMultiplier, calculatePotentialLoot } from '@caesars-loot/game-math';
import { GameDomainError } from '../common/game-domain.error.js';
import {
  GAME_UNIT_OF_WORK,
  type GameUnitOfWork,
  type RepositoryContext,
} from '../database/game-unit-of-work.js';
import { ROUND_REPOSITORY, type RoundRepository } from '../round/round.repository.js';
import type { RoundModel } from '../round/round.model.js';
import { SessionService } from '../session/session.service.js';
import { SESSION_REPOSITORY, type SessionRepository } from '../session/session.repository.js';
import { GameEventPublisher } from '../realtime/game-event.publisher.js';

export const TRAP_GENERATOR = Symbol('TRAP_GENERATOR');
export type TrapGenerator = (trapCount: number) => Set<number>;

@Injectable()
export class GameEngineService {
  private readonly logger = new Logger(GameEngineService.name);

  constructor(
    private readonly sessionService: SessionService,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(ROUND_REPOSITORY) private readonly rounds: RoundRepository,
    @Inject(GAME_UNIT_OF_WORK) private readonly unitOfWork: GameUnitOfWork,
    @Inject(TRAP_GENERATOR) private readonly generateTraps: TrapGenerator,
    private readonly events: GameEventPublisher,
  ) {}

  getConfig(): GameConfig {
    return {
      boardSize: BOARD_SIZE,
      allowedTrapCounts: TRAP_OPTIONS,
      allowedBets: ALLOWED_BETS,
      initialDemoCredits: INITIAL_DEMO_CREDITS,
    };
  }

  async startRound(input: StartRoundInput): Promise<StartRoundResult> {
    this.validateStart(input);
    const traps = this.generateTraps(input.trapCount);
    try {
      const result = await this.unitOfWork.transaction(async (repositories) => {
        const session = await this.sessionService.require(
          input.sessionId,
          repositories.sessions,
          true,
        );
        if (await repositories.rounds.findActiveBySessionId(session.id, true)) {
          throw new GameDomainError(
            'ROUND_ALREADY_ACTIVE',
            'This session already has an active round.',
            409,
          );
        }
        if (input.bet > session.demoCredits) {
          throw new GameDomainError(
            'INSUFFICIENT_DEMO_CREDITS',
            'Not enough demo credits for this bet.',
            409,
          );
        }
        session.demoCredits = this.money(session.demoCredits - input.bet);
        session.updatedAt = new Date();
        session.lastSeenAt = session.updatedAt;
        await repositories.sessions.update(session);
        const round = await repositories.rounds.create({
          id: randomUUID(),
          sessionId: session.id,
          bet: input.bet,
          trapCount: input.trapCount,
          trapTileIds: traps,
          revealedSafeTiles: new Set(),
          multiplier: 1,
          potentialLoot: input.bet,
          payout: 0,
          status: 'active',
          createdAt: new Date(),
        });
        await this.appendEvent(repositories, round.id, 'ROUND_STARTED', {
          bet: round.bet,
          trapCount: round.trapCount,
        });
        return this.toStartResult(round, session.demoCredits);
      });
      this.logger.log(`round persisted ${result.roundId} session=${input.sessionId}`);
      this.events.publish('ROUND_STARTED', input.sessionId, result, result.roundId);
      this.events.publish(
        'CREDITS_UPDATED',
        input.sessionId,
        { demoCredits: result.demoCredits, reason: 'round_started' },
        result.roundId,
      );
      return result;
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new GameDomainError(
          'ROUND_ALREADY_ACTIVE',
          'This session already has an active round.',
          409,
        );
      }
      throw error;
    }
  }

  async revealTile(input: RevealTileInput): Promise<RevealTileResult> {
    if (!Number.isInteger(input.tileId) || input.tileId < 0 || input.tileId >= BOARD_SIZE) {
      throw new GameDomainError('INVALID_TILE', 'Tile ID must be between 0 and 24.', 400);
    }
    const committed = await this.unitOfWork.transaction(async (repositories) => {
      const { session, round } = await this.requireActiveRound(
        input.sessionId,
        input.roundId,
        repositories,
      );
      if (round.revealedSafeTiles.has(input.tileId)) {
        throw new GameDomainError('TILE_ALREADY_REVEALED', 'This tile was already revealed.', 409);
      }
      if (round.trapTileIds.has(input.tileId)) {
        round.status = 'lost';
        round.multiplier = 0;
        round.potentialLoot = 0;
        round.payout = 0;
        round.finishedAt = new Date();
        await repositories.rounds.finish(round);
        await this.appendEvent(repositories, round.id, 'TILE_TRAP', {}, input.tileId);
        await this.appendEvent(repositories, round.id, 'ROUND_LOST');
        return {
          result: {
            roundId: round.id,
            tileId: input.tileId,
            result: 'trap' as const,
            status: 'lost' as const,
            multiplier: 0,
            potentialLoot: 0,
            revealedTiles: [...round.revealedSafeTiles],
            revealedTrapIds: [...round.trapTileIds],
          },
          demoCredits: session.demoCredits,
        };
      }
      round.revealedSafeTiles.add(input.tileId);
      round.multiplier = calculateMultiplier(round.trapCount, round.revealedSafeTiles.size);
      round.potentialLoot = calculatePotentialLoot(round.bet, round.multiplier);
      const completedBoard = round.revealedSafeTiles.size === BOARD_SIZE - round.trapCount;
      if (completedBoard) {
        round.status = 'won';
        round.payout = round.potentialLoot;
        round.finishedAt = new Date();
        session.demoCredits = this.money(session.demoCredits + round.payout);
        await repositories.sessions.update(session);
      }
      await repositories.rounds.update(round);
      await this.appendEvent(repositories, round.id, 'TILE_SAFE', {}, input.tileId);
      if (completedBoard) await this.appendEvent(repositories, round.id, 'ROUND_WON');
      return {
        result: {
          roundId: round.id,
          tileId: input.tileId,
          result: 'safe' as const,
          status: round.status,
          multiplier: round.multiplier,
          potentialLoot: round.potentialLoot,
          revealedTiles: [...round.revealedSafeTiles],
          ...(completedBoard ? { demoCredits: session.demoCredits, payout: round.payout } : {}),
        },
        demoCredits: session.demoCredits,
      };
    });
    const { result, demoCredits } = committed;
    this.events.publish(
      'TILE_REVEALED',
      input.sessionId,
      {
        tileId: input.tileId,
        result: result.result,
        status: result.status,
        revealedTiles: result.revealedTiles,
        ...('revealedTrapIds' in result ? { revealedTrapIds: result.revealedTrapIds } : {}),
      },
      input.roundId,
    );
    if (result.result === 'trap') {
      this.events.publish(
        'ROUND_LOST',
        input.sessionId,
        { demoCredits, revealedTrapIds: result.revealedTrapIds },
        input.roundId,
      );
    } else {
      this.events.publish(
        'MULTIPLIER_CHANGED',
        input.sessionId,
        { multiplier: result.multiplier, potentialLoot: result.potentialLoot },
        input.roundId,
      );
      if (result.status === 'won') {
        this.events.publish(
          'ROUND_WON',
          input.sessionId,
          { payout: result.payout ?? 0, multiplier: result.multiplier, demoCredits },
          input.roundId,
        );
        this.events.publish(
          'CREDITS_UPDATED',
          input.sessionId,
          { demoCredits, reason: 'board_completed' },
          input.roundId,
        );
      }
    }
    return result;
  }

  async cashOut(input: CashoutInput): Promise<CashoutResult> {
    const result = await this.unitOfWork.transaction(async (repositories) => {
      const { session, round } = await this.requireActiveRound(
        input.sessionId,
        input.roundId,
        repositories,
      );
      if (round.revealedSafeTiles.size === 0) {
        throw new GameDomainError(
          'CASHOUT_NOT_AVAILABLE',
          'Reveal at least one safe tile before cashing out.',
          409,
        );
      }
      round.status = 'won';
      round.payout = round.potentialLoot;
      round.finishedAt = new Date();
      session.demoCredits = this.money(session.demoCredits + round.payout);
      await repositories.rounds.finish(round);
      await repositories.sessions.update(session);
      await this.appendEvent(repositories, round.id, 'CASHOUT', { payout: round.payout });
      await this.appendEvent(repositories, round.id, 'ROUND_WON');
      return {
        roundId: round.id,
        status: 'won' as const,
        payout: round.payout,
        demoCredits: session.demoCredits,
        multiplier: round.multiplier,
      };
    });
    this.logger.log(`round persisted ${result.roundId} result=won payout=${result.payout}`);
    this.events.publish(
      'ROUND_WON',
      input.sessionId,
      { payout: result.payout, multiplier: result.multiplier, demoCredits: result.demoCredits },
      result.roundId,
    );
    this.events.publish(
      'CREDITS_UPDATED',
      input.sessionId,
      { demoCredits: result.demoCredits, reason: 'cashout' },
      result.roundId,
    );
    return result;
  }

  async getSessionState(sessionId: string): Promise<SessionStateResult> {
    const session = await this.sessionService.require(sessionId);
    await this.sessions.updateLastSeen(sessionId, new Date());
    const [activeRound, sessionRounds] = await Promise.all([
      this.rounds.findActiveBySessionId(sessionId),
      this.rounds.listBySessionId(sessionId, 6),
    ]);
    const lastCompletedRound = sessionRounds.find((round) => round.status !== 'active');
    return {
      sessionId,
      demoCredits: session.demoCredits,
      activeRound: activeRound ? this.toPublicRound(activeRound) : null,
      lastCompletedRound: lastCompletedRound ? this.toPublicRound(lastCompletedRound) : null,
    };
  }

  async getHistory(sessionId: string): Promise<RoundHistoryItem[]> {
    await this.sessionService.require(sessionId);
    return (await this.rounds.listBySessionId(sessionId, 6))
      .filter((round) => round.status !== 'active')
      .slice(0, 5)
      .map((round) => ({
        roundId: round.id,
        bet: round.bet,
        trapCount: round.trapCount,
        multiplier: round.multiplier,
        result: round.status === 'won' ? 'won' : 'lost',
        payout: round.payout,
      }));
  }

  private validateStart(input: StartRoundInput): void {
    if (!(ALLOWED_BETS as readonly number[]).includes(input.bet))
      throw new GameDomainError('INVALID_BET', 'Bet is not supported.', 400);
    if (!(TRAP_OPTIONS as readonly number[]).includes(input.trapCount))
      throw new GameDomainError('INVALID_TRAP_COUNT', 'Trap count is not supported.', 400);
  }

  private async requireActiveRound(
    sessionId: string,
    roundId: string,
    repositories: RepositoryContext,
  ) {
    const session = await this.sessionService.require(sessionId, repositories.sessions, true);
    const round = await repositories.rounds.findById(roundId, true);
    if (!round) throw new GameDomainError('ROUND_NOT_FOUND', 'Round was not found.', 404);
    if (round.sessionId !== session.id)
      throw new GameDomainError(
        'ROUND_SESSION_MISMATCH',
        'Round does not belong to this session.',
        409,
      );
    if (round.status !== 'active')
      throw new GameDomainError('ROUND_ALREADY_FINISHED', 'This round has already finished.', 409);
    return { session, round };
  }

  private async appendEvent(
    repositories: RepositoryContext,
    roundId: string,
    eventType: Parameters<RepositoryContext['events']['append']>[0]['eventType'],
    payload?: Record<string, unknown>,
    tileId?: number,
  ): Promise<void> {
    await repositories.events.append({
      id: randomUUID(),
      roundId,
      eventType,
      ...(tileId === undefined ? {} : { tileId }),
      ...(payload ? { payload } : {}),
      createdAt: new Date(),
    });
  }

  private toStartResult(round: RoundModel, demoCredits: number): StartRoundResult {
    return {
      roundId: round.id,
      status: 'active',
      bet: round.bet,
      trapCount: round.trapCount,
      multiplier: round.multiplier,
      potentialLoot: round.potentialLoot,
      demoCredits,
      revealedTiles: [],
    };
  }

  private toPublicRound(round: RoundModel) {
    return {
      roundId: round.id,
      status: round.status,
      bet: round.bet,
      trapCount: round.trapCount,
      revealedTiles: [...round.revealedSafeTiles],
      multiplier: round.multiplier,
      potentialLoot: round.potentialLoot,
      payout: round.payout,
      ...(round.status === 'lost' ? { revealedTrapIds: [...round.trapTileIds] } : {}),
    };
  }

  private money(value: number): number {
    return Math.round((value + Number.EPSILON) * 10_000) / 10_000;
  }
  private isUniqueViolation(error: unknown): boolean {
    return Boolean(error && typeof error === 'object' && 'code' in error && error.code === '23505');
  }
}
