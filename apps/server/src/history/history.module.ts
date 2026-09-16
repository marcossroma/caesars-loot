import { Module } from '@nestjs/common';
import { GameModule } from '../game/game.module.js';
import { HistoryController } from './history.controller.js';

@Module({ imports: [GameModule], controllers: [HistoryController] })
export class HistoryModule {}
