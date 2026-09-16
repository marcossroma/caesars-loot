import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { DevDelayInterceptor } from './common/dev-delay.interceptor.js';
import { GameErrorFilter } from './common/game-error.filter.js';
import { GameModule } from './game/game.module.js';
import { HealthModule } from './health/health.module.js';
import { HistoryModule } from './history/history.module.js';
import { SessionModule } from './session/session.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { DatabaseModule } from './database/database.module.js';

@Module({
  imports: [DatabaseModule, HealthModule, SessionModule, RealtimeModule, GameModule, HistoryModule],
  providers: [
    { provide: APP_FILTER, useClass: GameErrorFilter },
    { provide: APP_INTERCEPTOR, useClass: DevDelayInterceptor },
  ],
})
export class AppModule {}
