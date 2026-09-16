import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { INITIAL_DEMO_CREDITS, type DemoSession } from '@caesars-loot/shared';
import { GameDomainError } from '../common/game-domain.error.js';
import { SESSION_REPOSITORY, type SessionRepository } from './session.repository.js';

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(@Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository) {}

  async create(): Promise<DemoSession> {
    const now = new Date();
    const session = await this.sessions.create({
      id: randomUUID(),
      demoCredits: INITIAL_DEMO_CREDITS,
      createdAt: now,
      updatedAt: now,
      lastSeenAt: now,
      status: 'active',
    });
    this.logger.log(`session created ${session.id}`);
    return {
      sessionId: session.id,
      demoCredits: session.demoCredits,
      createdAt: session.createdAt.toISOString(),
    };
  }

  async require(sessionId: string, repository = this.sessions, lock = false) {
    const session = await repository.findById(sessionId, lock);
    if (!session) throw new GameDomainError('SESSION_NOT_FOUND', 'Session was not found.', 404);
    if (session.status === 'expired') {
      throw new GameDomainError('SESSION_NOT_FOUND', 'Session has expired.', 404);
    }
    return session;
  }
}
