export interface CoverTransform {
  scale: number;
  x: number;
  y: number;
}

export function calculateCoverTransform(
  sourceWidth: number,
  sourceHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): CoverTransform {
  if (sourceWidth <= 0 || sourceHeight <= 0 || viewportWidth <= 0 || viewportHeight <= 0) {
    return { scale: 1, x: 0, y: 0 };
  }

  const scale = Math.max(viewportWidth / sourceWidth, viewportHeight / sourceHeight);

  return {
    scale,
    x: (viewportWidth - sourceWidth * scale) / 2,
    y: (viewportHeight - sourceHeight * scale) / 2,
  };
}

export function clampRenderResolution(devicePixelRatio: number): number {
  return Math.min(Math.max(devicePixelRatio, 1), 2);
}
