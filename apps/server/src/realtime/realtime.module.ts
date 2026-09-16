import { Global, Module } from '@nestjs/common';
import { SessionModule } from '../session/session.module.js';
import { GameEventPublisher } from './game-event.publisher.js';
import { GameGateway } from './game.gateway.js';

@Global()
@Module({
  imports: [SessionModule],
  providers: [GameEventPublisher, GameGateway],
  exports: [GameEventPublisher],
})
export class RealtimeModule {}
