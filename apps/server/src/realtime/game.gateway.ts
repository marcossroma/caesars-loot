import type { IncomingMessage } from 'node:http';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { isUUID } from 'class-validator';
import type { JoinSessionInput, JoinSessionResult } from '@caesars-loot/shared';
import type { Server, Socket } from 'socket.io';
import { GameDomainError } from '../common/game-domain.error.js';
import { SessionService } from '../session/session.service.js';
import { GameEventPublisher } from './game-event.publisher.js';
import { originAllowed } from '../common/production-config.js';

@WebSocketGateway({
  namespace: '/game',
  cors: {
    origin: (origin, callback) => callback(null, originAllowed(origin)),
    methods: ['GET', 'POST'],
  },
  allowRequest: (request: IncomingMessage, callback) =>
    callback(null, originAllowed(request.headers.origin)),
})
export class GameGateway implements OnGatewayInit, OnModuleDestroy {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(GameGateway.name);

  constructor(
    private readonly sessions: SessionService,
    private readonly events: GameEventPublisher,
  ) {}

  afterInit(server: Server): void {
    this.events.attachTransport((room, event) => {
      server.to(room).emit(event.type, event);
    });
    this.logger.log('WebSocket gateway ready on /game');
  }

  onModuleDestroy(): void {
    this.events.detachTransport();
  }

  @SubscribeMessage('JOIN_SESSION')
  async joinSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() input: JoinSessionInput,
  ): Promise<JoinSessionResult> {
    if (!input || !isUUID(input.sessionId)) {
      return {
        ok: false,
        error: { code: 'INVALID_SESSION_ID', message: 'Unable to join session.' },
      };
    }

    try {
      const session = await this.sessions.require(input.sessionId);
      await client.join(`session:${session.id}`);
      this.events.publish('SESSION_READY', session.id, { demoCredits: session.demoCredits });
      this.events.publish('SERVER_STATUS', session.id, { status: 'online' });
      return {
        ok: true,
        socketId: client.id,
        sequence: this.events.getSequence(session.id),
      };
    } catch (error) {
      if (error instanceof GameDomainError) {
        return { ok: false, error: { code: error.code, message: 'Unable to join session.' } };
      }
      return {
        ok: false,
        error: { code: 'SESSION_JOIN_FAILED', message: 'Unable to join session.' },
      };
    }
  }
}
