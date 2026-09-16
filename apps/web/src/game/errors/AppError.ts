import { ApiClientError } from '../../services/api/ApiClient';

export type AppErrorCategory =
  'NETWORK' | 'SESSION' | 'ROUND' | 'VALIDATION' | 'SOCKET' | 'ASSET' | 'UNKNOWN';
export type RecoveryAction = 'retry' | 'resync' | 'new-session' | 'restart';

export interface AppError {
  id: string;
  code: string;
  category: AppErrorCategory;
  message: string;
  recoverable: boolean;
  recoveryAction: RecoveryAction;
  context?: string;
  technicalMessage?: string;
  timestamp: number;
}

const messages: Record<string, string> = {
  NETWORK_OFFLINE: 'Unable to reach the game server.',
  DATABASE_UNAVAILABLE: 'Game server temporarily unavailable.',
  REQUEST_TIMEOUT: 'The server took too long to respond. Your action was not retried.',
  REQUEST_ABORTED: 'The pending request was safely cancelled.',
  SESSION_NOT_FOUND: 'Your demo session expired.',
  INVALID_SESSION: 'Your demo session is no longer valid.',
  ROUND_ALREADY_ACTIVE: 'A raid is already active. Restoring it now.',
  ROUND_ALREADY_FINISHED: 'This raid already finished. Restoring the latest result.',
  TILE_ALREADY_REVEALED: 'That vault tile was already opened.',
  CASHOUT_NOT_AVAILABLE: 'Reveal a safe tile before escaping.',
  INSUFFICIENT_DEMO_CREDITS: 'There are not enough demo credits for that bet.',
  RENDERER_INIT_FAILED: 'Unable to initialize the game renderer.',
  ASSET_LOAD_FAILED: 'Some game art could not be loaded. A safe fallback is active.',
  STALE_RESPONSE: 'An outdated response was ignored.',
};

function categoryFor(code: string): AppErrorCategory {
  if (['NETWORK_OFFLINE', 'REQUEST_TIMEOUT', 'HTTP_ERROR', 'DATABASE_UNAVAILABLE'].includes(code))
    return 'NETWORK';
  if (['SESSION_NOT_FOUND', 'INVALID_SESSION'].includes(code)) return 'SESSION';
  if (code.includes('ROUND') || code.includes('TILE') || code.includes('CASHOUT')) return 'ROUND';
  if (code.includes('VALIDATION') || code.includes('INSUFFICIENT')) return 'VALIDATION';
  if (code.includes('SOCKET')) return 'SOCKET';
  if (code.includes('ASSET') || code.includes('RENDERER')) return 'ASSET';
  return 'UNKNOWN';
}

export function toAppError(error: unknown, context?: string): AppError {
  const code =
    error instanceof ApiClientError
      ? error.code
      : error instanceof Error && error.name === 'AbortError'
        ? 'REQUEST_ABORTED'
        : 'UNKNOWN_ERROR';
  const category = categoryFor(code);
  const session = category === 'SESSION';
  const recoverable =
    error instanceof ApiClientError
      ? error.retryable || session || error.status === 409
      : category !== 'UNKNOWN';
  return {
    id: `${code}:${context ?? 'app'}:${Date.now()}`,
    code,
    category,
    message: messages[code] ?? 'Something interrupted the heist.',
    recoverable,
    recoveryAction: session
      ? 'new-session'
      : category === 'ROUND'
        ? 'resync'
        : recoverable
          ? 'retry'
          : 'restart',
    ...(context ? { context } : {}),
    ...(import.meta.env.DEV && error instanceof Error ? { technicalMessage: error.message } : {}),
    timestamp: Date.now(),
  };
}

export function createAppError(
  code: string,
  message: string,
  category: AppErrorCategory,
  recoveryAction: RecoveryAction,
  context?: string,
): AppError {
  return {
    id: `${code}:${context ?? 'app'}:${Date.now()}`,
    code,
    category,
    message,
    recoverable: true,
    recoveryAction,
    ...(context ? { context } : {}),
    timestamp: Date.now(),
  };
}
