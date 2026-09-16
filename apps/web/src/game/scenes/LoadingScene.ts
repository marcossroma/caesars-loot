import { Container, Graphics, Text, type Ticker } from 'pixi.js';
import type { Scene } from './Scene';

export class LoadingScene implements Scene {
  readonly root = new Container();

  private readonly backdrop = new Graphics();
  private readonly glow = new Graphics();
  private readonly frame = new Graphics();
  private readonly progressTrack = new Graphics();
  private readonly progressFill = new Graphics();
  private readonly title = new Text({
    text: 'CAESAR’S LOOT',
    style: {
      fill: '#ffd56c',
      fontFamily: 'Georgia, Times New Roman, serif',
      fontSize: 72,
      fontWeight: 'bold',
      letterSpacing: 2,
      stroke: { color: '#59140e', width: 7 },
      dropShadow: { color: '#000000', alpha: 0.72, blur: 8, distance: 5 },
    },
  });
  private readonly loadingLabel = new Text({
    text: 'Loading treasures...',
    style: {
      fill: '#f6e6c1',
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: 18,
      letterSpacing: 3,
    },
  });
  private progress = 0;
  private elapsed = 0;

  constructor() {
    this.title.anchor.set(0.5);
    this.loadingLabel.anchor.set(0.5);
    this.root.addChild(
      this.backdrop,
      this.glow,
      this.frame,
      this.title,
      this.loadingLabel,
      this.progressTrack,
      this.progressFill,
    );
  }

  readonly update = (ticker: Ticker): void => {
    this.elapsed += ticker.deltaTime;
    this.glow.alpha = 0.34 + Math.sin(this.elapsed * 0.055) * 0.08;
  };

  setProgress(progress: number): void {
    this.progress = Math.min(Math.max(progress, 0), 1);
    this.drawProgress();
  }

  resize(width: number, height: number): void {
    const shortEdge = Math.min(width, height);
    const unscaledTitleWidth = this.title.width / this.title.scale.x;
    const titleScale = Math.min((width * 0.84) / unscaledTitleWidth, shortEdge / 620, 1.18);
    const barWidth = Math.min(width * 0.58, 340);
    const centreX = width / 2;
    const centreY = height / 2;

    this.backdrop.clear().rect(0, 0, width, height).fill({ color: 0x0b1013 });
    this.glow
      .clear()
      .circle(centreX, centreY - 30, Math.max(width, height) * 0.42)
      .fill({ color: 0x7f171a, alpha: 0.34 });
    this.frame
      .clear()
      .roundRect(18, 18, Math.max(width - 36, 1), Math.max(height - 36, 1), 18)
      .stroke({ color: 0xc68a32, width: 2, alpha: 0.58 });

    this.title.position.set(centreX, centreY - 58);
    this.title.scale.set(titleScale);
    this.loadingLabel.position.set(centreX, centreY + 46);
    this.loadingLabel.scale.set(Math.min(Math.max(shortEdge / 700, 0.78), 1));
    this.progressTrack.position.set(centreX - barWidth / 2, centreY + 88);
    this.progressFill.position.copyFrom(this.progressTrack.position);
    this.progressTrack.clear().roundRect(0, 0, barWidth, 8, 4).fill({ color: 0x3b2b24 });
    this.drawProgress(barWidth);
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }

  private drawProgress(width = this.progressTrack.width): void {
    const progressWidth = Math.max(width * this.progress, this.progress > 0 ? 8 : 0);
    this.progressFill.clear().roundRect(0, 0, progressWidth, 8, 4).fill({ color: 0xf4b942 });
  }
}
