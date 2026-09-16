import type { ApiErrorShape } from '@caesars-loot/shared';

export class ApiClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly activeControllers = new Set<AbortController>();

  constructor(
    baseUrl: string,
    private readonly timeoutMs = 6000,
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async get<T>(path: string): Promise<T> {
    try {
      return await this.request<T>(path, { method: 'GET' });
    } catch (error) {
      if (!(error instanceof ApiClientError) || !error.retryable) throw error;
      await new Promise((resolve) => globalThis.setTimeout(resolve, 180));
      return this.request<T>(path, { method: 'GET' });
    }
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }

  abortAll(): void {
    this.activeControllers.forEach((controller) => controller.abort('cancelled'));
    this.activeControllers.clear();
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const controller = new AbortController();
    this.activeControllers.add(controller);
    const timeout = globalThis.setTimeout(() => controller.abort('timeout'), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => null)) as ApiErrorShape | T | null;
      if (!response.ok) {
        const error = payload as ApiErrorShape | null;
        throw new ApiClientError(
          error?.code ?? 'HTTP_ERROR',
          error?.message ?? `Request failed with status ${response.status}.`,
          response.status,
          error?.retryable ?? response.status >= 500,
        );
      }
      if (payload === null)
        throw new ApiClientError('INVALID_RESPONSE', 'The API returned no data.', 502, false);
      return payload as T;
    } catch (error) {
      if (error instanceof ApiClientError) throw error;
      const aborted = error instanceof DOMException && error.name === 'AbortError';
      const isTimeout = aborted && controller.signal.reason === 'timeout';
      throw new ApiClientError(
        isTimeout ? 'REQUEST_TIMEOUT' : aborted ? 'REQUEST_ABORTED' : 'NETWORK_OFFLINE',
        isTimeout
          ? 'The server took too long to respond.'
          : aborted
            ? 'The request was cancelled.'
            : 'The game server is offline.',
        0,
        !aborted || isTimeout,
      );
    } finally {
      globalThis.clearTimeout(timeout);
      this.activeControllers.delete(controller);
    }
  }
}
