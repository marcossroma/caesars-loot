import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { BOARD_SIZE } from '@caesars-loot/shared';

export class RevealTileDto {
  @IsUUID()
  sessionId!: string;

  @IsUUID()
  roundId!: string;

  @IsInt()
  @Min(0)
  @Max(BOARD_SIZE - 1)
  tileId!: number;

  @IsOptional()
  @IsUUID()
  requestId?: string;
}
