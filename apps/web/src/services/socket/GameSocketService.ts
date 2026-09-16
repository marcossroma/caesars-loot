import {
  GAME_EVENT_TYPES,
  type GameEventType,
  type GameSocketEvent,
  type JoinSessionResult,
  type SocketState,
} from '@caesars-loot/shared';
import { io, type Manager, type Socket } from 'socket.io-client';

const DEFAULT_WS_URL = 'http://localhost:3000/game';

interface SocketRuntimeDiagnostics {
  activeConnections: number;
  maxActiveConnections: number;
  totalCreated: number;
  totalDestroyed: number;
}

declare global {
  interface Window {
    __CAESARS_LOOT_SOCKET__?: SocketRuntimeDiagnostics;
  }
}

const runtimeDiagnostics: SocketRuntimeDiagnostics = {
  activeConnections: 0,
  maxActiveConnections: 0,
  totalCreated: 0,
  totalDestroyed: 0,
};

function syncRuntimeDiagnostics(): void {
  if (!import.meta.env.DEV || typeof document === 'undefined') return;
  window.__CAESARS_LOOT_SOCKET__ = runtimeDiagnostics;
  document.documentElement.dataset['socketActive'] = String(runtimeDiagnostics.activeConnections);
  document.documentElement.dataset['socketMaxActive'] = String(
    runtimeDiagnostics.maxActiveConnections,
  );
  document.documentElement.dataset['socketCreated'] = String(runtimeDiagnostics.totalCreated);
  document.documentElement.dataset['socketDestroyed'] = String(runtimeDiagnostics.totalDestroyed);
}

export interface SocketDiagnostics {
  state: SocketState;
  socketId: string | null;
  pingMs: number | null;
  lastEvent: GameEventType | null;
  lastEventAt: number | null;
  reconnectAttempts: number;
  eventLog: readonly string[];
}

export interface GameSocketPort {
  getSnapshot(): SocketDiagnostics;
  subscribe(listener: () => void): () => void;
  on<K extends GameEventType>(type: K, listener: (event: GameSocketEvent<K>) => void): () => void;
  connect(sessionId: string): Promise<void>;
  disconnect(): void;
  reconnect(): Promise<void>;
  destroy(): void;
  setResyncHandler(handler: (() => Promise<void>) | null): void;
}

type SocketFactory = (url: string) => Socket;

function isGameSocketEvent(value: unknown): value is GameSocketEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Partial<GameSocketEvent>;
  return (
    typeof event.eventId === 'string' &&
    event.eventId.length > 0 &&
    typeof event.sessionId === 'string' &&
    typeof event.sequence === 'number' &&
    Number.isSafeInteger(event.sequence) &&
    event.sequence >= 0 &&
    typeof event.timestamp === 'string' &&
    !Number.isNaN(Date.parse(event.timestamp)) &&
    typeof event.type === 'string' &&
    GAME_EVENT_TYPES.includes(event.type) &&
    !!event.payload &&
    typeof event.payload === 'object'
  );
}

export class GameSocketService implements GameSocketPort {
  private socket: Socket | null = null;
  private manager: Manager | null = null;
  private sessionId: string | null = null;
  private connectPromise: Promise<void> | null = null;
  private resyncHandler: (() => Promise<void>) | null = null;
  private readonly listeners = new Set<() => void>();
  private readonly eventListeners = new Map<GameEventType, Set<(event: GameSocketEvent) => void>>();
  private readonly seenEventIds = new Set<string>();
  private lastSequence = 0;
  private joinedOnce = false;
  private connectionCounted = false;
  private diagnostics: SocketDiagnostics = {
    state: 'disconnected',
    socketId: null,
    pingMs: null,
    lastEvent: null,
    lastEventAt: null,
    reconnectAttempts: 0,
    eventLog: [],
  };

  constructor(
    private readonly url = import.meta.env.VITE_WS_URL ?? DEFAULT_WS_URL,
    private readonly factory: SocketFactory = (socketUrl) =>
      io(socketUrl, {
        autoConnect: false,
        reconnection: true,
        reconnectionAttempts: 8,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 8000,
        randomizationFactor: 0.25,
      }),
  ) {}

  getSnapshot = (): SocketDiagnostics => this.diagnostics;

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  on<K extends GameEventType>(type: K, listener: (event: GameSocketEvent<K>) => void): () => void {
    const listeners = this.eventListeners.get(type) ?? new Set();
    const wrapped = (event: GameSocketEvent) => listener(event as GameSocketEvent<K>);
    listeners.add(wrapped);
    this.eventListeners.set(type, listeners);
    return () => listeners.delete(wrapped);
  }

  setResyncHandler(handler: (() => Promise<void>) | null): void {
    this.resyncHandler = handler;
  }

  connect(sessionId: string): Promise<void> {
    this.sessionId = sessionId;
    this.ensureSocket();
    if (this.diagnostics.state === 'connected' && this.socket?.connected) return Promise.resolve();
    if (this.connectPromise) return this.connectPromise;
    this.patch({ state: this.joinedOnce ? 'reconnecting' : 'connecting' });
    this.connectPromise = new Promise<void>((resolve, reject) => {
      const socket = this.socket!;
      const onReady = () => {
        if (this.diagnostics.state === 'connected') {
          cleanup();
          resolve();
        } else if (this.diagnostics.state === 'error') {
          cleanup();
          reject(new Error('Unable to join the realtime session.'));
        }
      };
      const onFailure = (error: Error) => {
        cleanup();
        reject(error);
      };
      const cleanup = () => {
        this.listeners.delete(onReady);
        socket.off('connect_error', onFailure);
      };
      this.listeners.add(onReady);
      socket.once('connect_error', onFailure);
      socket.connect();
    }).finally(() => {
      this.connectPromise = null;
    });
    return this.connectPromise;
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.patch({ state: 'disconnected', socketId: null });
  }

  reconnect(): Promise<void> {
    if (!this.sessionId) return Promise.reject(new Error('No session is available to rejoin.'));
    return this.connect(this.sessionId);
  }

  destroy(): void {
    if (!this.socket) return;
    GAME_EVENT_TYPES.forEach((type) => this.socket?.off(type));
    this.socket.off('connect', this.handleConnect);
    this.socket.off('disconnect', this.handleDisconnect);
    this.socket.off('connect_error', this.handleConnectError);
    this.manager?.off('reconnect_attempt', this.handleReconnectAttempt);
    this.socket.disconnect();
    if (this.connectionCounted) {
      this.connectionCounted = false;
      runtimeDiagnostics.activeConnections = Math.max(0, runtimeDiagnostics.activeConnections - 1);
    }
    runtimeDiagnostics.totalDestroyed += 1;
    syncRuntimeDiagnostics();
    this.socket = null;
    this.manager = null;
    this.connectPromise = null;
    this.patch({ state: 'disconnected', socketId: null });
  }

  private ensureSocket(): void {
    if (this.socket) return;
    const socket = this.factory(this.url);
    runtimeDiagnostics.totalCreated += 1;
    syncRuntimeDiagnostics();
    this.socket = socket;
    this.manager = socket.io;
    socket.on('connect', this.handleConnect);
    socket.on('disconnect', this.handleDisconnect);
    socket.on('connect_error', this.handleConnectError);
    socket.io.on('reconnect_attempt', this.handleReconnectAttempt);
    GAME_EVENT_TYPES.forEach((type) => {
      socket.on(type, (event: unknown) => this.handleEvent(event));
    });
  }

  private readonly handleConnect = (): void => {
    if (!this.socket || !this.sessionId) return;
    if (!this.connectionCounted) {
      this.connectionCounted = true;
      runtimeDiagnostics.activeConnections += 1;
      runtimeDiagnostics.maxActiveConnections = Math.max(
        runtimeDiagnostics.maxActiveConnections,
        runtimeDiagnostics.activeConnections,
      );
      syncRuntimeDiagnostics();
    }
    const joinedAt = performance.now();
    this.socket.emit('JOIN_SESSION', { sessionId: this.sessionId }, (result: JoinSessionResult) => {
      if (!result.ok) {
        this.patch({ state: 'error', socketId: this.socket?.id ?? null });
        return;
      }
      const wasRejoin = this.joinedOnce;
      this.joinedOnce = true;
      // The publisher's sequence is process-local. A restart can return a lower sequence,
      // and resync below restores the authoritative state before future events arrive.
      this.lastSequence = result.sequence;
      this.patch({
        state: 'connected',
        socketId: result.socketId,
        pingMs: Math.round(performance.now() - joinedAt),
        reconnectAttempts: wasRejoin ? this.diagnostics.reconnectAttempts : 0,
      });
      if (wasRejoin) void this.resyncHandler?.();
    });
  };

  private readonly handleDisconnect = (reason: string): void => {
    if (this.connectionCounted) {
      this.connectionCounted = false;
      runtimeDiagnostics.activeConnections = Math.max(0, runtimeDiagnostics.activeConnections - 1);
      syncRuntimeDiagnostics();
    }
    const reconnecting = reason !== 'io client disconnect';
    this.patch({ state: reconnecting ? 'reconnecting' : 'disconnected', socketId: null });
  };

  private readonly handleConnectError = (): void => {
    this.patch({ state: this.joinedOnce ? 'reconnecting' : 'error', socketId: null });
  };

  private readonly handleReconnectAttempt = (attempt: number): void => {
    this.patch({ state: 'reconnecting', reconnectAttempts: attempt });
  };

  private handleEvent(event: unknown): void {
    if (!isGameSocketEvent(event)) return;
    if (event.sessionId !== this.sessionId || this.seenEventIds.has(event.eventId)) return;
    if (event.sequence <= this.lastSequence) return;
    this.lastSequence = event.sequence;
    this.seenEventIds.add(event.eventId);
    if (this.seenEventIds.size > 200) {
      const oldest = this.seenEventIds.values().next().value;
      if (oldest) this.seenEventIds.delete(oldest);
    }
    const time = new Date(event.timestamp).toLocaleTimeString([], { hour12: false });
    this.patch({
      lastEvent: event.type,
      lastEventAt: Date.now(),
      eventLog: [`${time} ${event.type}`, ...this.diagnostics.eventLog].slice(0, 8),
    });
    this.eventListeners.get(event.type)?.forEach((listener) => listener(event));
  }

  private patch(values: Partial<SocketDiagnostics>): void {
    this.diagnostics = { ...this.diagnostics, ...values };
    this.listeners.forEach((listener) => listener());
  }
}
