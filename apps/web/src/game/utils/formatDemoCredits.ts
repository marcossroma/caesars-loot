export function formatDemoCredits(value: number): string {
  const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0;
  return `${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeValue)} credits`;
}
