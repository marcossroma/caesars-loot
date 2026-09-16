import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from './ApiClient';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('ApiClient retry policy', () => {
  it('parses a successful JSON response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ value: 42 }), { status: 200 }),
    );
    await expect(new ApiClient('http://api.test').get('/success')).resolves.toEqual({ value: 42 });
  });

  it.each([
    [400, 'INVALID_BET', false],
    [404, 'SESSION_NOT_FOUND', false],
    [409, 'ROUND_ALREADY_FINISHED', false],
    [500, 'SERVER_FAILURE', true],
  ] as const)('normalizes HTTP %i error %s', async (status, code, retryable) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ code, message: 'Rejected', retryable }), { status }),
    );
    const request = new ApiClient('http://api.test').post('/command');
    await expect(request).rejects.toMatchObject({ code, status, retryable });
  });

  it('rejects malformed or empty successful responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('not-json', { status: 200 }));
    await expect(new ApiClient('http://api.test').post('/bad-json')).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });

  it('retries an idempotent GET once', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const result = await new ApiClient('http://api.test').get<{ ok: boolean }>('/config');
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('never retries a mutation automatically', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));
    await expect(new ApiClient('http://api.test').post('/rounds')).rejects.toMatchObject({
      code: 'NETWORK_OFFLINE',
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('distinguishes timeout from explicit abort', async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
    );
    const timeoutClient = new ApiClient('http://api.test', 20);
    const timedOut = timeoutClient.post('/timeout');
    const timeoutAssertion = expect(timedOut).rejects.toMatchObject({
      code: 'REQUEST_TIMEOUT',
      retryable: true,
    });
    await vi.advanceTimersByTimeAsync(21);
    await timeoutAssertion;

    const abortClient = new ApiClient('http://api.test', 1_000);
    const aborted = abortClient.post('/abort');
    abortClient.abortAll();
    await expect(aborted).rejects.toMatchObject({ code: 'REQUEST_ABORTED', retryable: false });
  });
});
