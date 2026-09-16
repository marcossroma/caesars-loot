import { Container, Graphics, type FederatedPointerEvent } from 'pixi.js';
import type { TweenManager } from '../animation/TweenManager';

export type LootTileState =
  'hidden' | 'hover' | 'pressed' | 'disabled' | 'revealing' | 'safe' | 'trap';

export interface LootTileOptions {
  id: number;
  row: number;
  column: number;
  tweenManager: TweenManager;
  onHover: (id: number | null) => void;
  onSelect: (tile: LootTile) => void;
}

export class LootTile {
  readonly id: number;
  readonly row: number;
  readonly column: number;
  readonly container = new Container();

  private readonly shadow = new Graphics();
  private readonly glow = new Graphics();
  private readonly face = new Graphics();
  private readonly inset = new Graphics();
  private readonly ornament = new Graphics();
  private readonly highlight = new Graphics();
  private readonly tweenManager: TweenManager;
  private readonly onHover: (id: number | null) => void;
  private readonly onSelect: (tile: LootTile) => void;
  private state: LootTileState = 'hidden';
  private scaleValue = 1;
  private glowValue = 0;
  private pointerInside = false;
  private interactionEnabled = true;
  private size = 0;
  private activePointerId: number | null = null;

  constructor(options: LootTileOptions) {
    this.id = options.id;
    this.row = options.row;
    this.column = options.column;
    this.tweenManager = options.tweenManager;
    this.onHover = options.onHover;
    this.onSelect = options.onSelect;

    this.container.eventMode = 'static';
    this.container.cursor = 'pointer';
    this.container.addChild(
      this.shadow,
      this.glow,
      this.face,
      this.inset,
      this.highlight,
      this.ornament,
    );
    this.bindInput();
  }

  get currentState(): LootTileState {
    return this.state;
  }

  layout(x: number, y: number, size: number): void {
    this.size = size;
    this.draw(size);
    this.container.pivot.set(size / 2);
    this.container.position.set(x + size / 2, y + size / 2);
  }

  setState(state: LootTileState): void {
    this.state = state;
    const disabled =
      state === 'disabled' || state === 'revealing' || state === 'safe' || state === 'trap';
    this.setInteractionEnabled(!disabled);
    this.container.alpha = disabled ? 0.46 : 1;
    if (state === 'revealing' || state === 'safe' || state === 'trap') this.container.alpha = 1;
    if (this.size > 0) this.draw(this.size);

    if (disabled) {
      this.animateScale(1);
      this.animateGlow(0);
    }
    if (state === 'revealing') {
      this.animateScale(0.9, 120);
      this.animateGlow(1, 100);
    } else if (state === 'safe' || state === 'trap') {
      this.animateScale(1.08, 90, () => this.animateScale(1, 150));
      this.animateGlow(state === 'trap' ? 1 : 0.72, 90);
    }
  }

  setInteractionEnabled(enabled: boolean): void {
    this.interactionEnabled = enabled;
    const canInteract = enabled && ['hidden', 'hover', 'pressed'].includes(this.state);
    this.container.eventMode = canInteract ? 'static' : 'none';
    this.container.cursor = canInteract ? 'pointer' : 'default';
    if (!enabled) {
      this.pointerInside = false;
      this.animateScale(1);
      this.animateGlow(0);
    }
  }

  reset(): void {
    this.pointerInside = false;
    this.setState('hidden');
    this.animateScale(1);
    this.animateGlow(0);
  }

  destroy(): void {
    this.tweenManager.cancel(this.scaleTweenId);
    this.tweenManager.cancel(this.glowTweenId);
    this.container.removeAllListeners();
    this.container.destroy({ children: true });
  }

  private get scaleTweenId(): string {
    return `tile-${this.id}-scale`;
  }

  private get glowTweenId(): string {
    return `tile-${this.id}-glow`;
  }

  private bindInput(): void {
    this.container.on('pointerover', this.handlePointerOver);
    this.container.on('pointerout', this.handlePointerOut);
    this.container.on('pointerdown', this.handlePointerDown);
    this.container.on('pointerup', this.handlePointerUp);
    this.container.on('pointerupoutside', this.handlePointerUpOutside);
    this.container.on('pointertap', this.handlePointerTap);
  }

  private readonly handlePointerOver = (): void => {
    if (!this.canInteract()) return;
    this.pointerInside = true;
    this.state = 'hover';
    this.animateScale(1.04);
    this.animateGlow(1);
    this.onHover(this.id);
  };

  private readonly handlePointerOut = (): void => {
    if (!this.canInteract()) return;
    this.pointerInside = false;
    this.state = 'hidden';
    this.animateScale(1);
    this.animateGlow(0);
    this.onHover(null);
  };

  private readonly handlePointerDown = (event: FederatedPointerEvent): void => {
    if (
      !this.canInteract() ||
      !event.isPrimary ||
      event.button !== 0 ||
      this.activePointerId !== null
    )
      return;
    event.stopPropagation();
    this.activePointerId = event.pointerId;
    this.state = 'pressed';
    this.animateScale(0.96, 80);
    this.animateGlow(0.72, 80);
  };

  private readonly handlePointerUp = (event: FederatedPointerEvent): void => {
    if (!this.canInteract() || !event.isPrimary || event.pointerId !== this.activePointerId) return;
    this.state = this.pointerInside ? 'hover' : 'hidden';
    this.animateScale(this.pointerInside ? 1.04 : 1);
    this.animateGlow(this.pointerInside ? 1 : 0);
  };

  private readonly handlePointerUpOutside = (event: FederatedPointerEvent): void => {
    if (!this.canInteract() || !event.isPrimary || event.pointerId !== this.activePointerId) return;
    this.pointerInside = false;
    this.state = 'hidden';
    this.animateScale(1);
    this.animateGlow(0);
    this.onHover(null);
    this.activePointerId = null;
  };

  private readonly handlePointerTap = (event: FederatedPointerEvent): void => {
    if (!this.canInteract() || !event.isPrimary || event.pointerId !== this.activePointerId) return;
    this.activePointerId = null;
    this.onSelect(this);
    this.animateScale(1.09, 90, () => {
      this.animateScale(this.pointerInside ? 1.04 : 1, 150);
    });
  };

  private canInteract(): boolean {
    return this.interactionEnabled && ['hidden', 'hover', 'pressed'].includes(this.state);
  }

  private animateScale(target: number, duration = 130, onComplete?: () => void): void {
    this.tweenManager.to({
      id: this.scaleTweenId,
      from: this.scaleValue,
      to: target,
      duration,
      onUpdate: (value) => {
        this.scaleValue = value;
        this.container.scale.set(value);
      },
      ...(onComplete ? { onComplete } : {}),
    });
  }

  private animateGlow(target: number, duration = 150): void {
    this.tweenManager.to({
      id: this.glowTweenId,
      from: this.glowValue,
      to: target,
      duration,
      onUpdate: (value) => {
        this.glowValue = value;
        this.glow.alpha = value;
        this.highlight.alpha = value * 0.2;
      },
    });
  }

  private draw(size: number): void {
    const radius = Math.max(size * 0.1, 7);
    const border = Math.max(size * 0.035, 2);
    const inset = Math.max(size * 0.09, 6);
    const centre = size / 2;
    const ornamentRadius = size * 0.16;

    this.shadow
      .clear()
      .roundRect(size * 0.035, size * 0.075, size * 0.96, size * 0.94, radius)
      .fill({ color: 0x050607, alpha: 0.72 });
    this.glow
      .clear()
      .roundRect(-border, -border, size + border * 2, size + border * 2, radius + border)
      .stroke({ color: 0xffc84f, width: border * 1.65, alpha: 0.94 });
    const faceColor =
      this.state === 'trap' ? 0x6f1519 : this.state === 'safe' ? 0x5b421e : 0x49352b;
    const insetColor =
      this.state === 'trap' ? 0x27090b : this.state === 'safe' ? 0x182116 : 0x211d1b;
    this.face.clear().roundRect(0, 0, size, size, radius).fill({ color: faceColor });
    this.inset
      .clear()
      .roundRect(border, border, size - border * 2, size - border * 2, radius - 1)
      .stroke({ color: 0xd69b42, width: border, alpha: 0.94 })
      .roundRect(inset, inset, size - inset * 2, size - inset * 2, radius * 0.64)
      .fill({ color: insetColor, alpha: 0.9 })
      .stroke({ color: 0x84603a, width: Math.max(border * 0.65, 1), alpha: 0.9 });
    this.highlight
      .clear()
      .roundRect(inset, inset, size - inset * 2, size - inset * 2, radius * 0.64)
      .fill({ color: 0xffd76e, alpha: 1 });
    this.ornament
      .clear()
      .circle(centre, centre, ornamentRadius)
      .stroke({ color: 0xc99745, width: Math.max(border * 0.7, 1.2), alpha: 0.85 })
      .moveTo(centre, centre - ornamentRadius * 0.72)
      .lineTo(centre + ornamentRadius * 0.72, centre)
      .lineTo(centre, centre + ornamentRadius * 0.72)
      .lineTo(centre - ornamentRadius * 0.72, centre)
      .closePath()
      .stroke({ color: 0xf0bd58, width: Math.max(border * 0.55, 1), alpha: 0.88 });

    const rivetRadius = Math.max(size * 0.022, 1.5);
    const rivetInset = inset * 0.62;
    const rivetPositions: Array<readonly [number, number]> = [
      [rivetInset, rivetInset],
      [size - rivetInset, rivetInset],
      [rivetInset, size - rivetInset],
      [size - rivetInset, size - rivetInset],
    ];
    for (const [x, y] of rivetPositions) {
      this.ornament.circle(x, y, rivetRadius).fill({ color: 0xe2aa4e });
    }

    if (this.state === 'safe') {
      this.ornament
        .circle(centre, centre, ornamentRadius * 1.25)
        .fill({ color: 0xf4b942 })
        .stroke({ color: 0xffe08a, width: border })
        .circle(centre, centre, ornamentRadius * 0.78)
        .stroke({ color: 0x9b5b16, width: border * 0.75 });
    } else if (this.state === 'trap') {
      const arm = ornamentRadius * 0.85;
      this.ornament
        .circle(centre, centre, ornamentRadius * 1.35)
        .stroke({ color: 0xff493f, width: border * 1.6 })
        .moveTo(centre - arm, centre - arm)
        .lineTo(centre + arm, centre + arm)
        .moveTo(centre + arm, centre - arm)
        .lineTo(centre - arm, centre + arm)
        .stroke({ color: 0xffd1a1, width: border * 1.8 });
    }

    const revealGlow = this.state === 'revealing' ? 1 : this.glowValue;
    this.glow.alpha = revealGlow;
    this.highlight.alpha = this.state === 'revealing' ? 0.32 : revealGlow * 0.2;
  }
}
