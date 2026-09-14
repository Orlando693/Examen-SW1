import { io } from 'socket.io-client';
import type { CollaborationAck, CollaborationSnapshot, PresenceInput, ProjectCommandAck, RealtimeCommandEnvelope } from './contracts';

const DEFAULT_REALTIME_URL = 'http://localhost:3001';

interface CollaborationSocket {
  on(event: string, listener: (...args: unknown[]) => void): CollaborationSocket;
  off(event: string, listener: (...args: unknown[]) => void): CollaborationSocket;
  emit(event: string, ...args: unknown[]): CollaborationSocket;
  disconnect(): CollaborationSocket;
  connected: boolean;
}

type SocketFactory = (url: string, options: { auth: { token: string }; transports: string[] }) => CollaborationSocket;
type CollaborationEvent = 'connect' | 'disconnect' | 'auth:expired' | 'project:presence' | 'project:revoked' | 'project:command-applied' | 'project:resource-updated';
type EventListener = (...args: unknown[]) => void;

const createSocket: SocketFactory = (url, options) => io(url, options) as unknown as CollaborationSocket;

export class CollaborationClient {
  private socket: CollaborationSocket | null = null;
  private projectId: string | null = null;
  private readonly listeners = new Map<CollaborationEvent, Set<EventListener>>();
  private readonly lifecycleListeners = new Map<CollaborationEvent, EventListener>();

  constructor(private readonly socketFactory: SocketFactory = createSocket, private readonly realtimeUrl = process.env.NEXT_PUBLIC_REALTIME_URL ?? DEFAULT_REALTIME_URL) {}

  get activeProjectId(): string | null { return this.projectId; }

  connect(accessToken: string): void {
    this.disconnect();
    const socket = this.socket = this.socketFactory(`${this.realtimeUrl}/collaboration`, { auth: { token: accessToken }, transports: ['websocket'] });
    for (const event of ['connect', 'disconnect', 'auth:expired'] as const) {
      const listener: EventListener = (...args) => { if (event === 'disconnect') this.projectId = null; this.notify(event, ...args); };
      this.lifecycleListeners.set(event, listener); socket.on(event, listener);
    }
    for (const [event, listeners] of this.listeners) {
      if (this.lifecycleListeners.has(event)) continue;
      for (const listener of listeners) socket.on(event, listener);
    }
  }

  async joinProject(projectId: string): Promise<CollaborationAck<CollaborationSnapshot>> {
    const ack = await this.emitAck<CollaborationSnapshot>('project:join', { projectId });
    if (ack.ok) this.projectId = projectId;
    return ack;
  }

  async leaveProject(): Promise<CollaborationAck<{ left: true }>> {
    const ack = await this.emitAck<{ left: true }>('project:leave');
    if (ack.ok) this.projectId = null;
    return ack;
  }

  async resync(): Promise<CollaborationAck<CollaborationSnapshot>> {
    if (!this.projectId) return { ok: false, error: { code: 'PROJECT_NOT_JOINED', message: 'No active project.' }, action: 'LEAVE' };
    return this.emitAck<CollaborationSnapshot>('project:resync');
  }

  submitRealtimeCommand(envelope: RealtimeCommandEnvelope): Promise<ProjectCommandAck> {
    return this.emitRawAck<ProjectCommandAck>('project:command', envelope);
  }

  publishPresence(presence: PresenceInput): boolean {
    if (!this.socket?.connected || !this.projectId) return false;
    this.socket.emit('project:presence', presence);
    return true;
  }

  subscribe(event: CollaborationEvent, listener: EventListener): () => void {
    const listeners = this.listeners.get(event) ?? new Set<EventListener>();
    listeners.add(listener); this.listeners.set(event, listeners);
    if (!this.lifecycleListeners.has(event)) this.socket?.on(event, listener);
    return () => { listeners.delete(listener); if (!this.lifecycleListeners.has(event)) this.socket?.off(event, listener); if (listeners.size === 0) this.listeners.delete(event); };
  }

  disconnect(): void {
    if (!this.socket) { this.projectId = null; return; }
    for (const [event, listener] of this.lifecycleListeners) this.socket.off(event, listener);
    for (const [event, listeners] of this.listeners) for (const listener of listeners) this.socket.off(event, listener);
    this.lifecycleListeners.clear(); this.socket.disconnect(); this.socket = null; this.projectId = null;
  }

  private emitAck<T>(event: string, payload?: unknown): Promise<CollaborationAck<T>> {
    return this.emitRawAck<CollaborationAck<T>>(event, payload);
  }

  private emitRawAck<T>(event: string, payload?: unknown): Promise<T> {
    const socket = this.socket;
    if (!socket) return Promise.resolve({ ok: false, error: { code: 'AUTHENTICATION_REQUIRED', message: 'Collaboration is disconnected.' }, action: 'REAUTHENTICATE' } as T);
    return new Promise((resolve) => {
      const acknowledge = (ack: T) => resolve(ack);
      if (payload === undefined) socket.emit(event, acknowledge); else socket.emit(event, payload, acknowledge);
    });
  }

  private notify(event: CollaborationEvent, ...args: unknown[]): void { for (const listener of this.listeners.get(event) ?? []) listener(...args); }
}
