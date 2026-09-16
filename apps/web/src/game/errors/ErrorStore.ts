import type { AppError } from './AppError';

export interface ErrorLogEntry {
  timestamp: number;
  code: string;
  context?: string;
}

export interface ErrorSnapshot {
  toasts: readonly AppError[];
  log: readonly ErrorLogEntry[];
}

export class ErrorStore {
  private readonly listeners = new Set<() => void>();
  private snapshot: ErrorSnapshot = { toasts: [], log: [] };

  getSnapshot = (): ErrorSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  push(error: AppError): void {
    const duplicate = this.snapshot.toasts.find(
      (item) => item.code === error.code && item.context === error.context,
    );
    const toasts = duplicate
      ? this.snapshot.toasts.map((item) =>
          item.id === duplicate.id ? { ...error, id: duplicate.id } : item,
        )
      : [...this.snapshot.toasts, error].slice(-3);
    const entry: ErrorLogEntry = {
      timestamp: error.timestamp,
      code: error.code,
      ...(error.context ? { context: error.context } : {}),
    };
    this.snapshot = { toasts, log: [...this.snapshot.log, entry].slice(-20) };
    this.emit();
  }

  dismiss(id: string): void {
    this.snapshot = {
      ...this.snapshot,
      toasts: this.snapshot.toasts.filter((item) => item.id !== id),
    };
    this.emit();
  }

  clear(): void {
    this.snapshot = { ...this.snapshot, toasts: [] };
    this.emit();
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener());
  }
}

export const errorStore = new ErrorStore();
