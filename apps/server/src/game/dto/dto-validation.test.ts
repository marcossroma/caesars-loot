import { describe, expect, it } from 'vitest';
import { validate } from 'class-validator';
import { StartRoundDto } from './start-round.dto.js';
import { RevealTileDto } from './reveal-tile.dto.js';
import { CashoutDto } from './cashout.dto.js';

describe('game DTO validation', () => {
  it('rejects unsupported start values', async () => {
    const dto = Object.assign(new StartRoundDto(), {
      sessionId: 'not-a-uuid',
      bet: 2,
      trapCount: 2,
    });
    expect(await validate(dto)).toHaveLength(3);
  });

  it('rejects out-of-range tiles at runtime', async () => {
    const dto = Object.assign(new RevealTileDto(), {
      sessionId: 'b940ea6a-9997-4bf4-bf64-628bef086d9a',
      roundId: '590a3f7e-6240-4c37-9f35-4929a77ecdf0',
      tileId: 25,
    });
    expect(await validate(dto)).toHaveLength(1);
  });

  it.each([
    [StartRoundDto, {}],
    [StartRoundDto, { sessionId: 'x'.repeat(10_000), bet: Number.NaN, trapCount: 3 }],
    [RevealTileDto, { sessionId: null, roundId: [], tileId: -1 }],
    [CashoutDto, { sessionId: {}, roundId: 'not-a-uuid' }],
  ])('rejects malformed and fuzz-lite payload %#', async (Dto, payload) => {
    expect(await validate(Object.assign(new Dto(), payload))).not.toHaveLength(0);
  });
});
