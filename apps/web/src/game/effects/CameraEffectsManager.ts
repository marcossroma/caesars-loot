import { Graphics, type Container, type Ticker } from 'pixi.js';
import { EFFECTS_CONFIG, type CameraFlashPreset, type CameraShakePreset } from './effects.config';

interface CameraTicker {
  add(callback: (ticker: Ticker) => void): object | void;
  remove(callback: (ticker: Ticker) => void): object | void;
}
export type CameraEffectState = 'idle' | 'shake' | 'zoom' | 'hit-stop' | 'flash';

export class CameraEffectsManager {
  private readonly flashLayer = new Graphics({ label: 'camera-flash' });
  private readonly darkenLayer = new Graphics({ label: 'camera-darken' });
  private width = 1;
  private height = 1;
  private shakeElapsed = 0;
  private shakeDuration = 0;
  private amplitude = 0;
  private zoomElapsed = 0;
  private zoomDuration = 0;
  private zoomAmount = 0;
  private flashElapsed = 0;
  private flashDuration = 0;
  private flashAlpha = 0;
  private flashColor = 0xffffff;
  private darkenAlpha = 0;
  private hitStopRemaining = 0;
  private disposed = false;
  constructor(
    private readonly ticker: CameraTicker,
    private readonly camera: Container,
    overlay: Container,
    private reducedMotion = false,
  ) {
    overlay.addChild(this.darkenLayer, this.flashLayer);
    this.ticker.add(this.update);
  }
  get currentState(): CameraEffectState {
    if (this.hitStopRemaining > 0) return 'hit-stop';
    if (this.shakeElapsed < this.shakeDuration) return 'shake';
    if (this.zoomElapsed < this.zoomDuration) return 'zoom';
    if (this.flashElapsed < this.flashDuration) return 'flash';
    return 'idle';
  }
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.camera.pivot.set(width / 2, height / 2);
    this.camera.position.set(width / 2, height / 2);
    this.redrawOverlays();
  }
  setReducedMotion(value: boolean): void {
    this.reducedMotion = value;
  }
  shake(preset: CameraShakePreset): void {
    const config = EFFECTS_CONFIG.shake[preset];
    this.shakeElapsed = 0;
    this.shakeDuration = config.duration;
    this.amplitude = config.amplitude * (this.reducedMotion ? 0.15 : 1);
  }
  flash(preset: CameraFlashPreset): void {
    const config = EFFECTS_CONFIG.flash[preset];
    this.flashElapsed = 0;
    this.flashDuration = config.duration;
    this.flashColor = config.color;
    this.flashAlpha = config.alpha * (this.reducedMotion ? 0.35 : 1);
    this.redrawOverlays();
  }
  zoomPunch(amount = 0.035, duration = 180): void {
    if (this.reducedMotion) return;
    this.zoomElapsed = 0;
    this.zoomDuration = duration;
    this.zoomAmount = amount;
  }
  hitStop(duration = EFFECTS_CONFIG.sequence.hitStop): void {
    this.hitStopRemaining = this.reducedMotion ? 0 : duration;
  }
  setDarkened(active: boolean): void {
    this.darkenAlpha = active ? EFFECTS_CONFIG.sequence.darkenAlpha : 0;
    this.redrawOverlays();
  }
  reset(): void {
    this.shakeElapsed =
      this.shakeDuration =
      this.zoomElapsed =
      this.zoomDuration =
      this.flashElapsed =
      this.flashDuration =
      this.hitStopRemaining =
        0;
    this.amplitude = 0;
    this.zoomAmount = 0;
    this.flashAlpha = 0;
    this.darkenAlpha = 0;
    this.camera.position.set(this.width / 2, this.height / 2);
    this.camera.scale.set(1);
    this.camera.rotation = 0;
    this.redrawOverlays();
  }
  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.ticker.remove(this.update);
    this.reset();
    this.flashLayer.destroy();
    this.darkenLayer.destroy();
  }
  private readonly update = (ticker: Ticker): void => {
    if (this.disposed) return;
    const delta = Math.min(ticker.deltaMS, 50);
    this.hitStopRemaining = Math.max(0, this.hitStopRemaining - delta);
    this.shakeElapsed += delta;
    this.zoomElapsed += delta;
    this.flashElapsed += delta;
    this.camera.position.set(this.width / 2, this.height / 2);
    this.camera.scale.set(1);
    this.camera.rotation = 0;
    if (this.shakeElapsed < this.shakeDuration) {
      const envelope = 1 - this.shakeElapsed / this.shakeDuration;
      this.camera.x += Math.sin(this.shakeElapsed * 0.19) * this.amplitude * envelope;
      this.camera.y += Math.cos(this.shakeElapsed * 0.27) * this.amplitude * 0.65 * envelope;
    }
    if (this.zoomElapsed < this.zoomDuration)
      this.camera.scale.set(
        1 + Math.sin((this.zoomElapsed / this.zoomDuration) * Math.PI) * this.zoomAmount,
      );
    this.flashLayer.alpha =
      this.flashElapsed < this.flashDuration
        ? this.flashAlpha * (1 - this.flashElapsed / this.flashDuration)
        : 0;
  };
  private redrawOverlays(): void {
    this.darkenLayer
      .clear()
      .rect(0, 0, this.width, this.height)
      .fill({ color: 0x050304, alpha: this.darkenAlpha });
    this.flashLayer.clear().rect(0, 0, this.width, this.height).fill(this.flashColor);
    this.flashLayer.alpha = this.flashElapsed < this.flashDuration ? this.flashAlpha : 0;
  }
}
