export type LayoutMode = 'mobile' | 'tablet' | 'desktop' | 'wide' | 'compact-landscape';

export const LAYOUT_CONFIG = {
  breakpoints: { mobile: 600, tablet: 900, wide: 1600, compactHeight: 500 },
  board: {
    max: 620,
    mobileHorizontalPadding: 12,
    desktopHorizontalPadding: 32,
    mobileHudReserve: 250,
    narrowHudReserve: 270,
    tabletHudReserve: 220,
    topMin: 86,
    topMax: 144,
    landscapeControls: 244,
  },
  touchTarget: 44,
  maxResolution: 2,
} as const;

export interface ResponsiveLayout {
  mode: LayoutMode;
  portrait: boolean;
  boardMaxSize: number;
  horizontalPadding: number;
  topReserve: number;
  bottomReserve: number;
  rightReserve: number;
  characterScale: number;
  effectsQuality: 'low' | 'medium' | 'high';
}

export function calculateResponsiveLayout(width: number, height: number): ResponsiveLayout {
  const portrait = height >= width;
  const compactLandscape = !portrait && height < LAYOUT_CONFIG.breakpoints.compactHeight;
  const mode: LayoutMode = compactLandscape
    ? 'compact-landscape'
    : width < LAYOUT_CONFIG.breakpoints.mobile
      ? 'mobile'
      : width < LAYOUT_CONFIG.breakpoints.tablet
        ? 'tablet'
        : width >= LAYOUT_CONFIG.breakpoints.wide
          ? 'wide'
          : 'desktop';
  const topReserve = compactLandscape
    ? 64
    : Math.min(Math.max(height * 0.14, LAYOUT_CONFIG.board.topMin), LAYOUT_CONFIG.board.topMax);
  const bottomReserve = compactLandscape
    ? 18
    : mode === 'mobile'
      ? height < 840
        ? LAYOUT_CONFIG.board.narrowHudReserve
        : LAYOUT_CONFIG.board.mobileHudReserve
      : mode === 'tablet'
        ? LAYOUT_CONFIG.board.tabletHudReserve
        : 24;
  return {
    mode,
    portrait,
    boardMaxSize: LAYOUT_CONFIG.board.max,
    horizontalPadding:
      mode === 'mobile'
        ? LAYOUT_CONFIG.board.mobileHorizontalPadding
        : LAYOUT_CONFIG.board.desktopHorizontalPadding,
    topReserve,
    bottomReserve,
    rightReserve: compactLandscape ? LAYOUT_CONFIG.board.landscapeControls : 0,
    characterScale:
      mode === 'mobile' ? 0.18 : mode === 'tablet' ? 0.3 : compactLandscape ? 0.28 : 0.72,
    effectsQuality:
      mode === 'mobile' || compactLandscape ? 'low' : mode === 'tablet' ? 'medium' : 'high',
  };
}
