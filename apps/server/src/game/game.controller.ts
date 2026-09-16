import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type {
  CashoutResult,
  GameConfig,
  RevealTileResult,
  StartRoundResult,
} from '@caesars-loot/shared';
import { CashoutDto } from './dto/cashout.dto.js';
import { RevealTileDto } from './dto/reveal-tile.dto.js';
import { StartRoundDto } from './dto/start-round.dto.js';
import { GameEngineService } from './game-engine.service.js';

@ApiTags('game')
@Controller('api/game')
export class GameController {
  constructor(private readonly game: GameEngineService) {}

  @Get('config')
  @ApiOkResponse({ description: 'Returns public demo game configuration.' })
  config(): GameConfig {
    return this.game.getConfig();
  }

  @Post('start')
  start(@Body() input: StartRoundDto): Promise<StartRoundResult> {
    return this.game.startRound(input);
  }

  @Post('reveal')
  reveal(@Body() input: RevealTileDto): Promise<RevealTileResult> {
    return this.game.revealTile(input);
  }

  @Post('cashout')
  cashout(@Body() input: CashoutDto): Promise<CashoutResult> {
    return this.game.cashOut(input);
  }
}
