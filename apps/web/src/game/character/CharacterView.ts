import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import type { CharacterTextures } from './CharacterAssetLoader';
import type { CharacterPose, CharacterState } from './characterTypes';

export interface CharacterViewPort {
  readonly root: Container;
  setState(state: CharacterState): void;
  applyPose(pose: CharacterPose): void;
  resetPose(): void;
  destroy(): void;
}

export class CharacterView implements CharacterViewPort {
  readonly root = new Container({ label: 'character' });
  private readonly shadow = new Graphics({ label: 'character-shadow' });
  private readonly actor = new Container({ label: 'character-actor' });
  private readonly cape = new Graphics();
  private readonly tail = new Graphics();
  private readonly legs = new Graphics();
  private readonly torso = new Graphics();
  private readonly armBack = new Graphics();
  private readonly armFront = new Graphics();
  private readonly head = new Container();
  private readonly ears = new Graphics();
  private readonly face = new Graphics();
  private readonly eyes = new Graphics();
  private readonly mouth = new Graphics();
  private readonly helmet = new Graphics();
  private readonly plume = new Graphics();
  private readonly coin = new Graphics();
  private readonly fallbackVisual = new Container();
  private readonly sprite = new Sprite();
  private readonly textures: CharacterTextures;

  constructor(textures: CharacterTextures = {}) {
    this.textures = textures;
    this.drawStaticArt();
    this.sprite.anchor.set(0.5, 1);
    this.sprite.visible = false;
    this.sprite.width = 220;
    this.sprite.height = 270;
    this.fallbackVisual.addChild(
      this.cape,
      this.tail,
      this.legs,
      this.torso,
      this.armBack,
      this.armFront,
      this.head,
      this.coin,
    );
    this.head.addChild(this.plume, this.helmet, this.ears, this.face, this.eyes, this.mouth);
    this.actor.addChild(this.fallbackVisual, this.sprite);
    this.root.addChild(this.shadow, this.actor);
    this.setState('idle');
    this.resetPose();
  }

  setState(state: CharacterState): void {
    const texture = this.textureFor(state);
    this.sprite.visible = Boolean(texture);
    this.fallbackVisual.visible = !texture;
    if (texture) this.sprite.texture = texture;

    this.drawExpression(state);
    this.coin.visible = ['happy', 'celebrate', 'escape'].includes(state);
    this.cape.tint = state === 'caught' ? 0x6d2326 : 0xffffff;
  }

  applyPose(pose: CharacterPose): void {
    this.actor.position.set(pose.x, pose.y);
    this.actor.scale.set(pose.scaleX, pose.scaleY);
    this.actor.rotation = pose.rotation;
    this.head.rotation = pose.headRotation;
    this.shadow.scale.set(pose.shadowScale, Math.max(0.72, pose.shadowScale));
    this.shadow.alpha = pose.shadowAlpha;
    this.coin.alpha = pose.coinAlpha;
    this.actor.tint = pose.bodyTint;
  }

  resetPose(): void {
    this.applyPose({
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      headRotation: 0,
      shadowScale: 1,
      shadowAlpha: 0.42,
      coinAlpha: 1,
      bodyTint: 0xffffff,
    });
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }

  private textureFor(state: CharacterState): Texture | undefined {
    if (state === 'celebrate') return this.textures.celebrate ?? this.textures.happy;
    if (['scared', 'surprised', 'caught'].includes(state)) return this.textures.scared;
    if (['happy', 'escape'].includes(state)) return this.textures.happy;
    return this.textures.idle;
  }

  private drawStaticArt(): void {
    this.shadow.ellipse(0, 2, 72, 17).fill({ color: 0x020203, alpha: 0.85 });
    this.cape
      .moveTo(-56, -185)
      .bezierCurveTo(-104, -146, -82, -50, -34, -35)
      .lineTo(-12, -152)
      .closePath()
      .fill({ color: 0x991f26 })
      .stroke({ color: 0x521013, width: 5 });
    this.tail
      .moveTo(-45, -96)
      .bezierCurveTo(-112, -92, -104, -24, -67, -42)
      .stroke({ color: 0x3e2419, width: 17 });
    this.legs
      .roundRect(-47, -66, 34, 62, 16)
      .roundRect(16, -66, 34, 62, 16)
      .fill({ color: 0x4b2c1d })
      .roundRect(-58, -17, 48, 18, 9)
      .roundRect(12, -17, 48, 18, 9)
      .fill({ color: 0x8b5a37 });
    this.torso
      .ellipse(0, -113, 63, 78)
      .fill({ color: 0x553120 })
      .roundRect(-52, -158, 104, 88, 28)
      .fill({ color: 0x7b4d2a })
      .roundRect(-47, -146, 94, 65, 18)
      .fill({ color: 0x6c3e23 })
      .stroke({ color: 0xc3913c, width: 6 })
      .rect(-48, -111, 96, 17)
      .fill({ color: 0x351d16 })
      .circle(0, -102, 12)
      .fill({ color: 0xe1a937 })
      .stroke({ color: 0x70400f, width: 3 });
    this.armBack
      .roundRect(-74, -143, 31, 84, 15)
      .fill({ color: 0x4b2b1e })
      .circle(-59, -57, 18)
      .fill({ color: 0xb77445 });
    this.armFront
      .roundRect(44, -153, 31, 87, 15)
      .fill({ color: 0x4b2b1e })
      .circle(60, -60, 18)
      .fill({ color: 0xb77445 });
    this.ears
      .circle(-61, -218, 27)
      .circle(61, -218, 27)
      .fill({ color: 0x9b5b39 })
      .circle(-61, -218, 15)
      .circle(61, -218, 15)
      .fill({ color: 0xd98a58 });
    this.face
      .ellipse(0, -218, 65, 62)
      .fill({ color: 0x5a321f })
      .ellipse(0, -205, 50, 43)
      .fill({ color: 0xd88b57 })
      .ellipse(0, -202, 31, 23)
      .fill({ color: 0xf0b477 });
    this.helmet
      .arc(0, -224, 67, Math.PI, 0)
      .lineTo(63, -219)
      .lineTo(-63, -219)
      .closePath()
      .fill({ color: 0x8b591f })
      .stroke({ color: 0xf0bd4d, width: 6 })
      .roundRect(-8, -288, 16, 72, 6)
      .fill({ color: 0xb9822f });
    this.plume
      .moveTo(-6, -282)
      .bezierCurveTo(-12, -340, 58, -353, 83, -318)
      .bezierCurveTo(52, -328, 21, -310, 7, -279)
      .closePath()
      .fill({ color: 0xc82428 })
      .stroke({ color: 0x741316, width: 4 });
    this.coin
      .circle(70, -72, 23)
      .fill({ color: 0xffc53d })
      .stroke({ color: 0x8c4b0f, width: 5 })
      .circle(70, -72, 14)
      .stroke({ color: 0xffe38b, width: 3 });
  }

  private drawExpression(state: CharacterState): void {
    const alarmed = ['surprised', 'scared'].includes(state);
    const sad = state === 'caught';
    const joyful = ['happy', 'celebrate', 'escape'].includes(state);
    this.eyes
      .clear()
      .ellipse(-22, -224, alarmed ? 13 : 11, alarmed ? 16 : 13)
      .ellipse(22, -224, alarmed ? 13 : 11, alarmed ? 16 : 13)
      .fill({ color: 0xfff4da })
      .circle(-19, -223, 5)
      .circle(19, -223, 5)
      .fill({ color: 0x14100d });
    this.mouth.clear();
    if (alarmed) {
      this.mouth
        .ellipse(0, -190, 14, 18)
        .fill({ color: 0x3a1012 })
        .stroke({ color: 0x6d241d, width: 3 });
    } else if (sad) {
      this.mouth
        .arc(0, -178, 22, Math.PI * 1.15, Math.PI * 1.85)
        .stroke({ color: 0x4c201a, width: 5 });
    } else if (joyful) {
      this.mouth.arc(0, -205, 25, 0.15, Math.PI - 0.15).stroke({ color: 0x4c201a, width: 6 });
    } else {
      this.mouth.arc(0, -205, 18, 0.25, Math.PI - 0.25).stroke({ color: 0x4c201a, width: 4 });
    }
  }
}
