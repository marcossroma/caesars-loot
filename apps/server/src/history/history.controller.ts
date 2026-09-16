import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { RoundHistoryItem } from '@caesars-loot/shared';
import { GameEngineService } from '../game/game-engine.service.js';

@ApiTags('history')
@Controller('api/game/history')
export class HistoryController {
  constructor(private readonly game: GameEngineService) {}

  @Get()
  @ApiQuery({ name: 'sessionId', format: 'uuid' })
  @ApiOkResponse({ description: 'Returns the five most recent completed rounds.' })
  history(@Query('sessionId') sessionId: string): Promise<RoundHistoryItem[]> {
    return this.game.getHistory(sessionId);
  }
}
