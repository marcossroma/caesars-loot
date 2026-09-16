import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getFoundationStatus(): { name: string; milestone: number; status: string } {
    return {
      name: 'Caesar’s Loot API',
      milestone: 1,
      status: 'foundation-ready',
    };
  }
}
