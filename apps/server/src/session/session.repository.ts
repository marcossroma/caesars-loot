import type { DemoSessionModel } from './session.model.js';

export const SESSION_REPOSITORY = Symbol('SESSION_REPOSITORY');

export interface SessionRepository {
  create(session: DemoSessionModel): Promise<DemoSessionModel>;
  findById(id: string, lock?: boolean): Promise<DemoSessionModel | undefined>;
  update(session: DemoSessionModel): Promise<void>;
  updateCredits(id: string, demoCredits: number): Promise<void>;
  updateLastSeen(id: string, at: Date): Promise<void>;
  expire(id: string): Promise<void>;
  clear?(): Promise<void>;
}

export class InMemorySessionRepository implements SessionRepository {
  private readonly sessions = new Map<string, DemoSessionModel>();

  create(session: DemoSessionModel): Promise<DemoSessionModel> {
    this.sessions.set(session.id, session);
    return Promise.resolve(session);
  }

  findById(id: string): Promise<DemoSessionModel | undefined> {
    return Promise.resolve(this.sessions.get(id));
  }

  update(session: DemoSessionModel): Promise<void> {
    this.sessions.set(session.id, session);
    return Promise.resolve();
  }

  updateCredits(id: string, demoCredits: number): Promise<void> {
    const session = this.sessions.get(id);
    if (session) this.sessions.set(id, { ...session, demoCredits, updatedAt: new Date() });
    return Promise.resolve();
  }

  updateLastSeen(id: string, at: Date): Promise<void> {
    const session = this.sessions.get(id);
    if (session) this.sessions.set(id, { ...session, lastSeenAt: at, updatedAt: at });
    return Promise.resolve();
  }

  expire(id: string): Promise<void> {
    const session = this.sessions.get(id);
    if (session) this.sessions.set(id, { ...session, status: 'expired', updatedAt: new Date() });
    return Promise.resolve();
  }

  clear(): Promise<void> {
    this.sessions.clear();
    return Promise.resolve();
  }

  snapshot(): Map<string, DemoSessionModel> {
    return new Map([...this.sessions].map(([id, session]) => [id, { ...session }]));
  }

  restore(snapshot: Map<string, DemoSessionModel>): void {
    this.sessions.clear();
    snapshot.forEach((session, id) => this.sessions.set(id, session));
  }
}
