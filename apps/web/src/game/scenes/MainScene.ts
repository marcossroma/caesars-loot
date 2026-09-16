import { Container, Graphics, Sprite, Text, type Texture, type Ticker } from 'pixi.js';
import { TweenManager } from '../animation/TweenManager';
import { BoardContainer, type BoardMetrics } from '../board/BoardContainer';
import type { LootTile } from '../board/LootTile';
import { calculateCoverTransform } from '../layout';
import type { Scene } from './Scene';
import type { GameController } from '../controller/GameController';
import { CharacterController } from '../character/CharacterController';
import { CharacterView } from '../character/CharacterView';
import type { CharacterTextures } from '../character/CharacterAssetLoader';
import { ParticleManager } from '../effects/ParticleManager';
import { CameraEffectsManager } from '../effects/CameraEffectsManager';
import { GameFeelDirector } from '../effects/GameFeelDirector';
import { calculateResponsiveLayout } from '../responsive/layout.config';
import { soundManager } from '../audio/SoundManager';
import { gameSettingsStore } from '../settings/GameSettingsStore';

export class MainScene implements Scene {
  readonly root = new Container();

  private readonly backgroundLayer = new Container({ label: 'background-layer' });
  private readonly ambientLayer = new Container({ label: 'ambient-layer' });
  private readonly cameraLayer = new Container({ label: 'camera-layer' });
  private readonly characterLayer = new Container({ label: 'character-layer' });
  private readonly boardLayer = new Container({ label: 'board-layer' });
  private readonly foregroundLayer = new Container({ label: 'foreground-effects-layer' });
  private readonly uiLayer = new Container({ label: 'ui-layer' });
  private readonly fallback = new Graphics();
  private readonly shade = new Graphics();
  private readonly frame = new Graphics();
  private readonly title = new Text({
    text: 'CAESAR’S LOOT',
    style: {
      fill: '#ffd66d',
      fontFamily: 'Georgia, Times New Roman, serif',
      fontSize: 58,
      fontWeight: 'bold',
      letterSpacing: 2,
      stroke: { color: '#5b160f', width: 6 },
      dropShadow: { color: '#000000', alpha: 0.8, blur: 8, distance: 4 },
    },
  });
  private readonly subtitle = new Text({
    text: 'THE VAULT AWAITS',
    style: {
      fill: '#f3dfb5',
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: 15,
      fontWeight: 'bold',
      letterSpacing: 5,
    },
  });
  private readonly background: Sprite | null;
  private readonly tweenManager: TweenManager;
  private readonly board: BoardContainer;
  private readonly character: CharacterController;
  private readonly particles: ParticleManager;
  private readonly cameraEffects: CameraEffectsManager;
  private readonly gameFeel: GameFeelDirector;
  private viewport = { width: 1, height: 1 };
  private readonly bindingOwner = {};
  private readonly controller: GameController;

  constructor(
    texture: Texture | null,
    ticker: Ticker,
    onBoardMetrics: (metrics: BoardMetrics) => void,
    onTileSelected: (tile: LootTile) => void,
    controller: GameController,
    characterTextures: CharacterTextures,
  ) {
    this.controller = controller;
    this.background = texture ? new Sprite(texture) : null;
    this.tweenManager = new TweenManager(ticker);
    this.board = new BoardContainer({
      tweenManager: this.tweenManager,
      onMetricsChange: onBoardMetrics,
      onTileSelected,
    });
    controller.bindBoard(this.board, this.bindingOwner);
    const characterView = new CharacterView(characterTextures);
    this.character = new CharacterController({
      ticker,
      view: characterView,
      onDiagnostics: (metrics) => controller.updateCharacterDiagnostics(metrics, this.bindingOwner),
    });
    controller.bindCharacter(this.character, this.bindingOwner);
    const reducedMotion =
      typeof window !== 'undefined' &&
      (window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        gameSettingsStore.getSnapshot().reducedEffects);
    this.particles = new ParticleManager({
      ticker,
      effectsRoot: this.foregroundLayer,
      ambientRoot: this.ambientLayer,
      quality: calculateResponsiveLayout(window.innerWidth, window.innerHeight).effectsQuality,
      reducedMotion,
      onDiagnostics: (metrics) =>
        controller.updateEffectDiagnostics(
          {
            ...metrics,
            cameraState: this.cameraEffects?.currentState ?? 'idle',
            scheduledEffects: this.gameFeel?.getDiagnostics().scheduledEffects ?? 0,
            listenerCount: this.gameFeel?.getDiagnostics().listenerCount ?? 0,
          },
          this.bindingOwner,
        ),
    });
    this.cameraEffects = new CameraEffectsManager(
      ticker,
      this.cameraLayer,
      this.uiLayer,
      reducedMotion,
    );
    this.gameFeel = new GameFeelDirector(
      controller.events,
      ticker,
      this.particles,
      this.cameraEffects,
      this.character,
      (id) => this.board.getTileCenter(id),
      () => ({ x: this.viewport.width / 2, y: this.viewport.height / 2 }),
      (metrics) => controller.updateEffectDiagnostics(metrics, this.bindingOwner),
      soundManager,
    );
    controller.bindGameFeel(this.gameFeel, this.bindingOwner);
    this.title.anchor.set(0.5);
    this.subtitle.anchor.set(0.5);

    this.root.addChild(this.backgroundLayer, this.ambientLayer, this.cameraLayer, this.uiLayer);
    this.backgroundLayer.addChild(this.fallback);
    if (this.background) {
      this.backgroundLayer.addChild(this.background);
    }
    this.ambientLayer.addChild(this.shade);
    this.cameraLayer.addChild(this.characterLayer, this.boardLayer, this.foregroundLayer);
    this.characterLayer.addChild(this.character.root);
    this.boardLayer.addChild(this.board.root);
    this.uiLayer.addChild(this.frame, this.title, this.subtitle);
  }

  resize(width: number, height: number): void {
    this.viewport = { width, height };
    const shortEdge = Math.min(width, height);
    const centreX = width / 2;
    const unscaledTitleWidth = this.title.width / this.title.scale.x;

    this.fallback.clear().rect(0, 0, width, height).fill({ color: 0x171a1d });

    if (this.background) {
      const transform = calculateCoverTransform(
        this.background.texture.width,
        this.background.texture.height,
        width,
        height,
      );
      this.background.scale.set(transform.scale);
      this.background.position.set(transform.x, transform.y);
    }

    this.shade.clear().rect(0, 0, width, height).fill({ color: 0x08090a, alpha: 0.28 });
    this.frame
      .clear()
      .roundRect(18, 18, Math.max(width - 36, 1), Math.max(height - 36, 1), 18)
      .stroke({ color: 0xe0a83c, width: 2, alpha: 0.7 });
    this.board.resize(width, height);
    this.character.resize(width, height);
    this.cameraEffects.resize(width, height);
    this.particles.setQuality(calculateResponsiveLayout(width, height).effectsQuality);
    this.title.position.set(centreX, Math.min(Math.max(height * 0.075, 48), 82));
    this.title.scale.set(Math.min((width * 0.82) / unscaledTitleWidth, shortEdge / 720, 1.08));
    this.subtitle.text = 'CHOOSE A VAULT TILE';
    this.subtitle.position.set(centreX, Math.min(Math.max(height * 0.13, 82), 124));
    this.subtitle.scale.set(Math.min(Math.max(shortEdge / 680, 0.78), 1));
  }

  destroy(): void {
    this.gameFeel.destroy();
    this.particles.destroy();
    this.cameraEffects.destroy();
    this.controller.bindGameFeel(null, this.bindingOwner);
    this.boardLayer.removeChild(this.board.root);
    this.board.destroy();
    this.characterLayer.removeChild(this.character.root);
    this.character.destroy();
    this.controller.bindCharacter(null, this.bindingOwner);
    this.controller.bindBoard(null, this.bindingOwner);
    this.tweenManager.destroy();
    this.root.destroy({ children: true });
  }
}
