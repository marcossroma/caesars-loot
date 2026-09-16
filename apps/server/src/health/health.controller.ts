import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { DatabaseService } from '../database/database.service.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  @ApiOkResponse({ description: 'Service readiness endpoint.' })
  async health(): Promise<{ status: 'ok'; service: string; database: 'connected' | 'memory' }> {
    const healthy = await this.database.ping();
    if (!healthy) {
      throw new HttpException(
        { status: 'unavailable', service: 'caesars-loot-server', database: 'unavailable' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return {
      status: 'ok',
      service: 'caesars-loot-server',
      database: this.database.connected ? 'connected' : 'memory',
    };
  }
}
