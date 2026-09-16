import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SessionStateResult } from '@caesars-loot/shared';
import { GameEngineService } from './game-engine.service.js';

@ApiTags('session')
@Controller('api/session')
export class SessionStateController {
  constructor(private readonly game: GameEngineService) {}

  @Get(':sessionId/state')
  @ApiOperation({ summary: 'Get authoritative state for reconnect synchronization' })
  state(@Param('sessionId', new ParseUUIDPipe()) sessionId: string): Promise<SessionStateResult> {
    return this.game.getSessionState(sessionId);
  }
}
