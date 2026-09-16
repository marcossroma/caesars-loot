import { IsIn, IsNumber, IsOptional, IsUUID } from 'class-validator';
import { ALLOWED_BETS, TRAP_OPTIONS } from '@caesars-loot/shared';

export class StartRoundDto {
  @IsUUID()
  sessionId!: string;

  @IsNumber()
  @IsIn(ALLOWED_BETS)
  bet!: number;

  @IsNumber()
  @IsIn(TRAP_OPTIONS)
  trapCount!: number;

  @IsOptional()
  @IsUUID()
  requestId?: string;
}
