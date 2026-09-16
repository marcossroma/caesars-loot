import { calculateResponsiveLayout, type ResponsiveLayout } from './layout.config';

export interface ViewportMetrics {
  width: number;
  height: number;
  layout: ResponsiveLayout;
}

export class ResponsiveLayoutManager {
  private readonly observer: ResizeObserver;
  private frame: number | null = null;
  private disposed = false;

  constructor(
    private readonly host: HTMLElement,
    private readonly onResize: (metrics: ViewportMetrics) => void,
  ) {
    this.observer = new ResizeObserver(this.schedule);
    this.observer.observe(host);
    window.addEventListener('resize', this.schedule, { passive: true });
    window.visualViewport?.addEventListener('resize', this.schedule, { passive: true });
    window.addEventListener('orientationchange', this.schedule, { passive: true });
    this.schedule();
  }

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.observer.disconnect();
    window.removeEventListener('resize', this.schedule);
    window.visualViewport?.removeEventListener('resize', this.schedule);
    window.removeEventListener('orientationchange', this.schedule);
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
  }

  private readonly schedule = (): void => {
    if (this.disposed || this.frame !== null) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      const width = Math.max(Math.round(this.host.clientWidth), 1);
      const height = Math.max(Math.round(this.host.clientHeight), 1);
      const layout = calculateResponsiveLayout(width, height);
      document.documentElement.dataset['layoutMode'] = layout.mode;
      document.documentElement.dataset['orientation'] = layout.portrait ? 'portrait' : 'landscape';
      this.onResize({ width, height, layout });
    });
  };
}
