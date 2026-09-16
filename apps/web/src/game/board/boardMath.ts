export const BOARD_ROWS = 5;
export const BOARD_COLUMNS = 5;
export const BOARD_TILE_COUNT = BOARD_ROWS * BOARD_COLUMNS;

export interface TileCoordinates {
  row: number;
  column: number;
}

export interface BoardCell extends TileCoordinates {
  id: number;
}

export interface BoardLayout {
  boardSize: number;
  tileSize: number;
  gap: number;
  x: number;
  y: number;
}

export function getTileIndex(row: number, column: number): number | null {
  if (
    !Number.isInteger(row) ||
    !Number.isInteger(column) ||
    row < 0 ||
    row >= BOARD_ROWS ||
    column < 0 ||
    column >= BOARD_COLUMNS
  ) {
    return null;
  }

  return row * BOARD_COLUMNS + column;
}

export function getTileCoordinates(index: number): TileCoordinates | null {
  if (!Number.isInteger(index) || index < 0 || index >= BOARD_TILE_COUNT) {
    return null;
  }

  return {
    row: Math.floor(index / BOARD_COLUMNS),
    column: index % BOARD_COLUMNS,
  };
}

export function createBoardCells(): BoardCell[] {
  const cells: BoardCell[] = [];

  for (let row = 0; row < BOARD_ROWS; row += 1) {
    for (let column = 0; column < BOARD_COLUMNS; column += 1) {
      const id = getTileIndex(row, column);
      if (id !== null) {
        cells.push({ id, row, column });
      }
    }
  }

  return cells;
}

export function calculateBoardLayout(viewportWidth: number, viewportHeight: number): BoardLayout {
  const responsive = calculateResponsiveLayout(viewportWidth, viewportHeight);
  const availableWidth = Math.max(
    viewportWidth - responsive.horizontalPadding * 2 - responsive.rightReserve,
    1,
  );
  const availableHeight = Math.max(
    viewportHeight - responsive.topReserve - responsive.bottomReserve,
    1,
  );
  const boardSize = Math.min(availableWidth, availableHeight, responsive.boardMaxSize);
  const gap = Math.min(Math.max(boardSize * 0.018, 5), 11);
  const tileSize = (boardSize - gap * (BOARD_COLUMNS - 1)) / BOARD_COLUMNS;

  return {
    boardSize,
    tileSize,
    gap,
    x: (viewportWidth - responsive.rightReserve - boardSize) / 2,
    y: responsive.topReserve + Math.max((availableHeight - boardSize) / 2, 0),
  };
}
import { calculateResponsiveLayout } from '../responsive/layout.config';
