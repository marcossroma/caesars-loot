import { Application, Assets, Graphics, Sprite, Text, type Container, type Texture } from 'pixi.js';
import { BACKGROUND_ASSET } from '../assets';
import { clampRenderResolution } from '../layout';
import type { BoardMetrics } from '../board/BoardContainer';
import type { LootTile } from '../board/LootTile';
import { LoadingScene } from '../scenes/LoadingScene';
import { MainScene } from '../scenes/MainScene';
import type { Scene } from '../scenes/Scene';
import type { GameController } from '../controller/GameController';
import { devLogger } from '../logging/devLogger';
import { loadCharacterAssets, type LoadedCharacterAssets } from '../character/CharacterAssetLoader';
import { ResponsiveLayoutManager } from '../responsive/ResponsiveLayoutManager';

export interface PixiRuntimeStatus {
  phase: 'booting' | 'loading' | 'ready' | 'error';
  progress: number;
}

export interface PixiDiagnostics {
  activeApplications: number;
  maxActiveApplications: number;
  totalCreated: number;
  totalDestroyed: number;
  resizeCount: number;
  lastViewport: string;
  status: PixiRuntimeStatus['phase'];
  tileCount: number;
  hoveredTile: number | null;
  selectedTile: number | null;
  boardSize: number;
  tileSize: number;
  displayObjects: number;
  spriteCount: number;
  graphicsCount: number;
  containerCount: number;
  textCount: number;
  tickerCallbacks: number;
}

declare global {
  interface Window {
    __CAESARS_LOOT_PIXI__?: PixiDiagnostics;
  }
}

const diagnostics: PixiDiagnostics = {
  activeApplications: 0,
  maxActiveApplications: 0,
  totalCreated: 0,
  totalDestroyed: 0,
  resizeCount: 0,
  lastViewport: '0x0',
  status: 'booting',
  tileCount: 0,
  hoveredTile: null,
  selectedTile: null,
  boardSize: 0,
  tileSize: 0,
  displayObjects: 0,
  spriteCount: 0,
  graphicsCount: 0,
  containerCount: 0,
  textCount: 0,
  tickerCallbacks: 0,
};

if (import.meta.env.DEV) {
  window.__CAESARS_LOOT_PIXI__ = diagnostics;
}

function syncDiagnostics(): void {
  if (!import.meta.env.DEV) {
    return;
  }

  document.documentElement.dataset['pixiActive'] = String(diagnostics.activeApplications);
  document.documentElement.dataset['pixiMaxActive'] = String(diagnostics.maxActiveApplications);
  document.documentElement.dataset['pixiCreated'] = String(diagnostics.totalCreated);
  document.documentElement.dataset['pixiDestroyed'] = String(diagnostics.totalDestroyed);
  document.documentElement.dataset['pixiResizes'] = String(diagnostics.resizeCount);
  document.documentElement.dataset['pixiViewport'] = diagnostics.lastViewport;
  document.documentElement.dataset['pixiStatus'] = diagnostics.status;
  document.documentElement.dataset['pixiTiles'] = String(diagnostics.tileCount);
  document.documentElement.dataset['pixiHovered'] = String(diagnostics.hoveredTile ?? 'none');
  document.documentElement.dataset['pixiSelected'] = String(diagnostics.selectedTile ?? 'none');
  document.documentElement.dataset['pixiBoardSize'] = diagnostics.boardSize.toFixed(1);
  document.documentElement.dataset['pixiTileSize'] = diagnostics.tileSize.toFixed(1);
  document.documentElement.dataset['pixiObjects'] = String(diagnostics.displayObjects);
  document.documentElement.dataset['pixiSprites'] = String(diagnostics.spriteCount);
  document.documentElement.dataset['pixiGraphics'] = String(diagnostics.graphicsCount);
  document.documentElement.dataset['pixiContainers'] = String(diagnostics.containerCount);
  document.documentElement.dataset['pixiText'] = String(diagnostics.textCount);
  document.documentElement.dataset['pixiTickers'] = String(diagnostics.tickerCallbacks);
}

function updateDisplayObjectDiagnostics(root: Container): void {
  const counts = {
    displayObjects: 0,
    spriteCount: 0,
    graphicsCount: 0,
    containerCount: 0,
    textCount: 0,
  };
  const visit = (node: Container): void => {
    counts.displayObjects += 1;
    if (node instanceof Text) counts.textCount += 1;
    else if (node instanceof Sprite) counts.spriteCount += 1;
    else if (node instanceof Graphics) counts.graphicsCount += 1;
    else counts.containerCount += 1;
    node.children.forEach((child) => visit(child));
  };
  visit(root);
  Object.assign(diagnostics, counts);
  syncDiagnostics();
}

class PixiRuntime {
  private readonly app = new Application();
  private readonly listeners = new Set<(status: PixiRuntimeStatus) => void>();
  private host: HTMLDivElement | null = null;
  private layoutManager: ResponsiveLayoutManager | null = null;
  private scene: Scene | null = null;
  private loadingScene: LoadingScene | null = null;
  private status: PixiRuntimeStatus = { phase: 'booting', progress: 0 };
  private initialized = false;
  private destroyed = false;
  private loadedCharacterSources: string[] = [];
  private readonly initialization: Promise<void>;

  constructor(private readonly controller: GameController) {
    diagnostics.activeApplications += 1;
    diagnostics.totalCreated += 1;
    diagnostics.maxActiveApplications = Math.max(
      diagnostics.maxActiveApplications,
      diagnostics.activeApplications,
    );
    syncDiagnostics();
    this.initialization = this.initialize();
  }

  attach(host: HTMLDivElement, listener: (status: PixiRuntimeStatus) => void): void {
    this.host = host;
    this.listeners.add(listener);
    listener(this.status);

    if (this.initialized) {
      this.attachCanvas();
      this.observeHost();
      this.resize();
    }
  }

  detach(listener: (status: PixiRuntimeStatus) => void): void {
    this.listeners.delete(listener);
  }

  async destroy(): Promise<void> {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    this.layoutManager?.destroy();
    this.layoutManager = null;

    await this.initialization.catch(() => undefined);
    if (this.loadingScene) {
      this.app.ticker.remove(this.loadingScene.update);
    }
    this.scene?.destroy();
    this.scene = null;
    this.loadingScene = null;

    if (this.initialized) {
      this.app.stage.removeChildren();
      this.app.destroy({ removeView: true }, { children: true });
    }

    await Assets.unload(BACKGROUND_ASSET.src).catch(() => undefined);
    await Promise.all(
      this.loadedCharacterSources.map((source) => Assets.unload(source).catch(() => undefined)),
    );
    this.loadedCharacterSources = [];
    Object.assign(diagnostics, {
      displayObjects: 0,
      spriteCount: 0,
      graphicsCount: 0,
      containerCount: 0,
      textCount: 0,
      tickerCallbacks: 0,
    });
    diagnostics.activeApplications = Math.max(0, diagnostics.activeApplications - 1);
    diagnostics.totalDestroyed += 1;
    syncDiagnostics();
  }

  private async initialize(): Promise<void> {
    try {
      performance.mark('caesars-loot:pixi-init-start');
      await this.app.init({
        antialias: true,
        autoDensity: true,
        backgroundAlpha: 0,
        preference: 'webgl',
        resolution: clampRenderResolution(window.devicePixelRatio),
      });
      performance.mark('caesars-loot:pixi-init-end');
      performance.measure(
        'caesars-loot:pixi-init',
        'caesars-loot:pixi-init-start',
        'caesars-loot:pixi-init-end',
      );

      this.initialized = true;
      if (this.destroyed) {
        this.app.destroy({ removeView: true }, { children: true });
        return;
      }

      this.attachCanvas();
      this.observeHost();
      this.showLoadingScene();
      this.setStatus({ phase: 'loading', progress: 0.04 });
      this.resize();

      performance.mark('caesars-loot:assets-load-start');
      const [texture, characterAssets] = await Promise.all([
        this.loadBackground(),
        loadCharacterAssets(),
      ]);
      this.loadedCharacterSources = characterAssets.loadedSources;
      performance.mark('caesars-loot:assets-loaded');
      performance.measure(
        'caesars-loot:assets-load',
        'caesars-loot:assets-load-start',
        'caesars-loot:assets-loaded',
      );

      if (this.destroyed) {
        return;
      }

      this.showMainScene(texture, characterAssets);
      performance.mark('caesars-loot:pixi-ready');
      this.setStatus({ phase: 'ready', progress: 1 });
      this.resize();
    } catch (error) {
      devLogger.error('Unable to initialize the PixiJS scene.', error);
      if (!this.destroyed) {
        this.setStatus({ phase: 'error', progress: 0 });
      }
    }
  }

  private async loadBackground(): Promise<Texture | null> {
    try {
      return await Assets.load<Texture>(BACKGROUND_ASSET.src, (progress) => {
        const normalizedProgress = 0.04 + progress * 0.96;
        this.loadingScene?.setProgress(normalizedProgress);
        this.setStatus({ phase: 'loading', progress: normalizedProgress });
      });
    } catch (error) {
      devLogger.warn('Background asset unavailable; using the PixiJS fallback.', error);
      this.controller.reportAssetFallback('background');
      this.loadingScene?.setProgress(1);
      return null;
    }
  }

  private showLoadingScene(): void {
    this.scene?.destroy();
    const loadingScene = new LoadingScene();
    this.loadingScene = loadingScene;
    this.scene = loadingScene;
    this.app.stage.addChild(loadingScene.root);
    this.app.ticker.add(loadingScene.update);
    diagnostics.tickerCallbacks = 1;
    updateDisplayObjectDiagnostics(loadingScene.root);
  }

  private showMainScene(texture: Texture | null, characterAssets: LoadedCharacterAssets): void {
    if (this.loadingScene) {
      this.app.ticker.remove(this.loadingScene.update);
    }
    this.app.stage.removeChildren();
    this.scene?.destroy();
    this.loadingScene = null;

    const mainScene = new MainScene(
      texture,
      this.app.ticker,
      this.handleBoardMetrics,
      this.handleTileSelected,
      this.controller,
      characterAssets.textures,
    );
    this.scene = mainScene;
    this.app.stage.addChild(mainScene.root);
    diagnostics.tickerCallbacks = 5;
    updateDisplayObjectDiagnostics(mainScene.root);
  }

  private attachCanvas(): void {
    if (!this.host || this.destroyed) {
      return;
    }

    this.app.canvas.className = 'pixi-canvas';
    this.app.canvas.setAttribute('aria-hidden', 'true');
    this.host.replaceChildren(this.app.canvas);
  }

  private observeHost(): void {
    if (!this.host || this.layoutManager) {
      return;
    }

    this.layoutManager = new ResponsiveLayoutManager(this.host, ({ width, height }) =>
      this.resize(width, height),
    );
  }

  private resize(width?: number, height?: number): void {
    if (!this.host || !this.initialized || this.destroyed) {
      return;
    }

    const nextWidth = width ?? Math.max(Math.round(this.host.clientWidth), 1);
    const nextHeight = height ?? Math.max(Math.round(this.host.clientHeight), 1);
    this.app.renderer.resize(nextWidth, nextHeight);
    this.scene?.resize(nextWidth, nextHeight);
    diagnostics.resizeCount += 1;
    diagnostics.lastViewport = `${nextWidth}x${nextHeight}`;
    syncDiagnostics();
  }

  private setStatus(status: PixiRuntimeStatus): void {
    this.status = status;
    diagnostics.status = status.phase;
    syncDiagnostics();
    this.listeners.forEach((listener) => listener(status));
  }

  private readonly handleBoardMetrics = (metrics: BoardMetrics): void => {
    diagnostics.tileCount = metrics.tileCount;
    diagnostics.hoveredTile = metrics.hoveredTile;
    diagnostics.selectedTile = metrics.selectedTile;
    diagnostics.boardSize = metrics.boardSize;
    diagnostics.tileSize = metrics.tileSize;
    syncDiagnostics();
  };

  private readonly handleTileSelected = (tile: LootTile): void => {
    void this.controller.revealTile(tile.id);
    if (import.meta.env.DEV) {
      devLogger.debug(`Tile clicked: row=${tile.row} col=${tile.column} id=${tile.id}`);
    }
  };
}

let sharedRuntime: PixiRuntime | null = null;
let leaseCount = 0;
let disposalGeneration = 0;

export function acquirePixiRuntime(
  host: HTMLDivElement,
  listener: (status: PixiRuntimeStatus) => void,
  controller: GameController,
): () => void {
  disposalGeneration += 1;
  leaseCount += 1;
  sharedRuntime ??= new PixiRuntime(controller);
  const runtime = sharedRuntime;
  runtime.attach(host, listener);

  return () => {
    runtime.detach(listener);
    leaseCount = Math.max(0, leaseCount - 1);
    const currentGeneration = ++disposalGeneration;

    queueMicrotask(() => {
      if (
        leaseCount === 0 &&
        currentGeneration === disposalGeneration &&
        sharedRuntime === runtime
      ) {
        sharedRuntime = null;
        void runtime.destroy();
      }
    });
  };
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    const runtime = sharedRuntime;
    sharedRuntime = null;
    leaseCount = 0;
    disposalGeneration += 1;
    if (runtime) {
      void runtime.destroy();
    }
  });
}
