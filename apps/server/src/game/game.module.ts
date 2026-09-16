import { Module } from '@nestjs/common';
import { generateTrapIds } from '../round/trap-generator.js';
import { SessionModule } from '../session/session.module.js';
import { GameController } from './game.controller.js';
import { GameEngineService, TRAP_GENERATOR } from './game-engine.service.js';
import { SessionStateController } from './session-state.controller.js';

@Module({
  imports: [SessionModule],
  controllers: [GameController, SessionStateController],
  providers: [GameEngineService, { provide: TRAP_GENERATOR, useValue: generateTrapIds }],
  exports: [GameEngineService],
})
export class GameModule {}
