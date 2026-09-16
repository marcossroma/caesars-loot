import { describe, expect, it } from 'vitest';
import {
  BOARD_TILE_COUNT,
  calculateBoardLayout,
  createBoardCells,
  getTileCoordinates,
  getTileIndex,
} from './boardMath';

describe('board indexing', () => {
  it('generates exactly 25 deterministic cells', () => {
    const cells = createBoardCells();

    expect(cells).toHaveLength(BOARD_TILE_COUNT);
    expect(cells[0]).toEqual({ id: 0, row: 0, column: 0 });
    expect(cells[24]).toEqual({ id: 24, row: 4, column: 4 });
  });

  it('converts coordinates to tile IDs', () => {
    expect(getTileIndex(0, 0)).toBe(0);
    expect(getTileIndex(2, 4)).toBe(14);
    expect(getTileIndex(4, 4)).toBe(24);
  });

  it('converts tile IDs to coordinates', () => {
    expect(getTileCoordinates(0)).toEqual({ row: 0, column: 0 });
    expect(getTileCoordinates(14)).toEqual({ row: 2, column: 4 });
    expect(getTileCoordinates(24)).toEqual({ row: 4, column: 4 });
  });

  it('rejects invalid coordinates and tile IDs', () => {
    expect(getTileIndex(-1, 0)).toBeNull();
    expect(getTileIndex(0, 5)).toBeNull();
    expect(getTileCoordinates(-1)).toBeNull();
    expect(getTileCoordinates(25)).toBeNull();
    expect(getTileCoordinates(2.5)).toBeNull();
  });
});

describe('board sizing', () => {
  it.each([
    [360, 800],
    [390, 844],
    [375, 812],
    [393, 873],
    [412, 915],
    [430, 932],
    [768, 1024],
    [844, 390],
    [932, 430],
    [1366, 768],
    [1920, 1080],
  ])('keeps the board inside a %ix%i viewport', (width, height) => {
    const layout = calculateBoardLayout(width, height);

    expect(layout.x).toBeGreaterThanOrEqual(0);
    expect(layout.y).toBeGreaterThanOrEqual(0);
    expect(layout.x + layout.boardSize).toBeLessThanOrEqual(width);
    expect(layout.y + layout.boardSize).toBeLessThanOrEqual(height);
    expect(layout.tileSize).toBeGreaterThan(0);
    expect(layout.tileSize).toBeGreaterThanOrEqual(44);
  });
});
