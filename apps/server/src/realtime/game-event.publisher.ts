import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { GameEventPayloadMap, GameEventType, GameSocketEvent } from '@caesars-loot/shared';

export type GameEventTransport = (room: string, event: GameSocketEvent) => void;

@Injectable()
export class GameEventPublisher {
  private readonly sequences = new Map<string, number>();
  private transport: GameEventTransport | null = null;

  attachTransport(transport: GameEventTransport): void {
    this.transport = transport;
  }

  detachTransport(): void {
    this.transport = null;
  }

  getSequence(sessionId: string): number {
    return this.sequences.get(sessionId) ?? 0;
  }

  publish<K extends GameEventType>(
    type: K,
    sessionId: string,
    payload: GameEventPayloadMap[K],
    roundId?: string,
  ): GameSocketEvent<K> {
    const sequence = this.getSequence(sessionId) + 1;
    this.sequences.set(sessionId, sequence);
    const event = {
      eventId: randomUUID(),
      type,
      timestamp: new Date().toISOString(),
      version: 1,
      sequence,
      sessionId,
      ...(roundId ? { roundId } : {}),
      payload,
    } as GameSocketEvent<K>;
    this.transport?.(`session:${sessionId}`, event as unknown as GameSocketEvent);
    return event;
  }
}
