import { Container, Graphics } from 'pixi.js';
import type { TweenManager } from '../animation/TweenManager';
import {
  BOARD_TILE_COUNT,
  calculateBoardLayout,
  createBoardCells,
  type BoardLayout,
} from './boardMath';
import { LootTile, type LootTileState } from './LootTile';

export interface BoardMetrics extends BoardLayout {
  tileCount: number;
  hoveredTile: number | null;
  selectedTile: number | null;
}

export interface BoardContainerOptions {
  tweenManager: TweenManager;
  onMetricsChange: (metrics: BoardMetrics) => void;
  onTileSelected: (tile: LootTile) => void;
}

export class BoardContainer {
  readonly root = new Container();

  private readonly plate = new Graphics();
  private readonly tiles = new Map<number, LootTile>();
  private readonly onMetricsChange: (metrics: BoardMetrics) => void;
  private readonly onTileSelected: (tile: LootTile) => void;
  private layoutMetrics: BoardLayout = {
    boardSize: 0,
    tileSize: 0,
    gap: 0,
    x: 0,
    y: 0,
  };
  private hoveredTile: number | null = null;
  private selectedTile: number | null = null;

  constructor(options: BoardContainerOptions) {
    this.onMetricsChange = options.onMetricsChange;
    this.onTileSelected = options.onTileSelected;
    this.root.addChild(this.plate);

    for (const cell of createBoardCells()) {
      const tile = new LootTile({
        ...cell,
        tweenManager: options.tweenManager,
        onHover: this.handleHover,
        onSelect: this.handleSelect,
      });
      this.tiles.set(tile.id, tile);
      this.root.addChild(tile.container);
    }
  }

  get tileCount(): number {
    return this.tiles.size;
  }

  getTile(id: number): LootTile | undefined {
    return this.tiles.get(id);
  }

  getTileCenter(id: number): { x: number; y: number } {
    const tile = this.tiles.get(id);
    if (!tile)
      return {
        x: this.layoutMetrics.x + this.layoutMetrics.boardSize / 2,
        y: this.layoutMetrics.y + this.layoutMetrics.boardSize / 2,
      };
    return {
      x: this.root.x + tile.container.x + this.layoutMetrics.tileSize / 2,
      y: this.root.y + tile.container.y + this.layoutMetrics.tileSize / 2,
    };
  }

  setTileState(id: number, state: LootTileState): boolean {
    const tile = this.getTile(id);
    if (!tile) {
      return false;
    }

    tile.setState(state);
    return true;
  }

  disableAll(): void {
    this.tiles.forEach((tile) => tile.setInteractionEnabled(false));
    this.hoveredTile = null;
    this.emitMetrics();
  }

  enableAll(): void {
    this.tiles.forEach((tile) => tile.setInteractionEnabled(tile.currentState === 'hidden'));
    this.emitMetrics();
  }

  playTrapFeedback(): void {
    // Camera motion is owned by GameFeelDirector; keep this compatibility hook drift-free.
    this.root.position.set(this.layoutMetrics.x, this.layoutMetrics.y);
  }

  reset(): void {
    this.hoveredTile = null;
    this.selectedTile = null;
    this.tiles.forEach((tile) => tile.reset());
    this.emitMetrics();
  }

  resize(viewportWidth: number, viewportHeight: number): void {
    this.layoutMetrics = calculateBoardLayout(viewportWidth, viewportHeight);
    const { boardSize, tileSize, gap, x, y } = this.layoutMetrics;
    const platePadding = Math.max(gap * 1.15, 7);

    this.root.position.set(x, y);
    this.plate
      .clear()
      .roundRect(
        -platePadding,
        -platePadding,
        boardSize + platePadding * 2,
        boardSize + platePadding * 2,
        Math.max(tileSize * 0.13, 12),
      )
      .fill({ color: 0x090b0d, alpha: 0.68 })
      .stroke({ color: 0xb57b2c, width: Math.max(gap * 0.28, 1.5), alpha: 0.76 });

    this.tiles.forEach((tile) => {
      const tileX = tile.column * (tileSize + gap);
      const tileY = tile.row * (tileSize + gap);
      tile.layout(tileX, tileY, tileSize);
    });
    this.emitMetrics();
  }

  destroy(): void {
    this.tiles.forEach((tile) => tile.destroy());
    this.tiles.clear();
    this.root.removeChildren();
    this.plate.destroy();
    this.root.destroy();
  }

  private readonly handleHover = (id: number | null): void => {
    this.hoveredTile = id;
    this.emitMetrics();
  };

  private readonly handleSelect = (tile: LootTile): void => {
    this.selectedTile = tile.id;
    this.onTileSelected(tile);
    this.emitMetrics();
  };

  private emitMetrics(): void {
    this.onMetricsChange({
      ...this.layoutMetrics,
      tileCount: this.tiles.size || BOARD_TILE_COUNT,
      hoveredTile: this.hoveredTile,
      selectedTile: this.selectedTile,
    });
  }
}
