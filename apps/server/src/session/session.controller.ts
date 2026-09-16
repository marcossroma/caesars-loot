import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import type { DemoSession } from '@caesars-loot/shared';
import { SessionService } from './session.service.js';

@ApiTags('session')
@Controller('api/session')
export class SessionController {
  constructor(private readonly sessions: SessionService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ description: 'Creates an anonymous persisted demo session.' })
  create(): Promise<DemoSession> {
    return this.sessions.create();
  }
}
