export const devLogger = {
  debug(message: string, details?: unknown): void {
    if (import.meta.env.DEV) console.debug(`[Caesar's Loot] ${message}`, details ?? '');
  },
  warn(message: string, details?: unknown): void {
    if (import.meta.env.DEV) console.warn(`[Caesar's Loot] ${message}`, details ?? '');
  },
  error(message: string, details?: unknown): void {
    console.error(`[Caesar's Loot] ${message}`, details ?? '');
  },
};
