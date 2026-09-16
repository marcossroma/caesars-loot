import { IsOptional, IsUUID } from 'class-validator';

export class CashoutDto {
  @IsUUID()
  sessionId!: string;

  @IsUUID()
  roundId!: string;

  @IsOptional()
  @IsUUID()
  requestId?: string;
}
