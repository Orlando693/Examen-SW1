import { Inject } from '@nestjs/common';
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { AccessTokenAuthenticator } from '../auth/access-token-authenticator.js';
import type { SafeUser } from '../auth/users.repository.js';
import { CollaborationService } from './collaboration.service.js';
import { PresenceRateLimiter } from './presence-rate-limiter.js';
import { collaborationRoom, type CollaborationAck, type CollaborationError, type PresenceInput } from './contracts.js';

interface SocketState {
  lifecycleGeneration: number;
  activeProjectId: string | null;
  activeSessionId: string | null;
  user: SafeUser;
  expiresAt: number;
  expirationTimer: NodeJS.Timeout | null;
  presenceWindowStartedAt: number;
  presenceCount: number;
}

const MAX_SELECTION_IDS = 50;
const MAX_PRESENCE_UPDATES_PER_SECOND = 30;

const allowedOrigins = (process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000').split(',').map((origin) => origin.trim());
@WebSocketGateway({ namespace: '/collaboration', cors: { origin: allowedOrigins, credentials: false }, maxHttpBufferSize: 32_768, allowRequest: (request, callback) => callback(null, !request.headers.origin || allowedOrigins.includes(request.headers.origin)) })
export class CollaborationGateway {
  @WebSocketServer() private server!: Server;
  constructor(@Inject(AccessTokenAuthenticator) private readonly authenticator: AccessTokenAuthenticator, @Inject(CollaborationService) private readonly collaboration: CollaborationService, @Inject(PresenceRateLimiter) private readonly presenceRateLimiter: PresenceRateLimiter = new PresenceRateLimiter()) {}

  afterInit(server: Server): void {
    server.use(async (socket, next) => {
      const token = socket.handshake.auth?.token;
      if (typeof token !== 'string') return next(new Error('Authentication required'));
      try {
        socket.data.collaborationAuthentication = await this.authenticator.authenticate(token);
        next();
      } catch { next(new Error('Authentication required')); }
    });
  }

  async handleConnection(socket: Socket): Promise<void> {
    const authenticated = socket.data.collaborationAuthentication as { user: SafeUser; expiresAt: number } | undefined;
    if (!authenticated) { socket.disconnect(true); return; }
    delete socket.data.collaborationAuthentication;
    const state: SocketState = { lifecycleGeneration: 0, activeProjectId: null, activeSessionId: null, user: authenticated.user, expiresAt: authenticated.expiresAt, expirationTimer: null, presenceWindowStartedAt: Date.now(), presenceCount: 0 };
    state.expirationTimer = setTimeout(() => { void this.expire(socket); }, Math.max(0, state.expiresAt - Date.now()));
    socket.data.collaboration = state;
  }

  handleDisconnect(socket: Socket): void { this.presenceRateLimiter.remove(socket.id); void this.leave(socket); }

  @SubscribeMessage('project:join')
  async join(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<CollaborationAck<unknown>> {
    const projectId = typeof body === 'object' && body !== null && 'projectId' in body && typeof body.projectId === 'string' ? body.projectId : null;
    if (!projectId) return this.failure('INVALID_COMMAND', 'Invalid join request.', 'NONE');
    const state = this.state(socket);
    if (!state) return this.failure('AUTHENTICATION_REQUIRED', 'Authentication is required.', 'REAUTHENTICATE');
    const generation = ++state.lifecycleGeneration;
    await this.leave(socket, false);
    try {
      await this.authenticator.revalidate(state.user, state.expiresAt);
      const snapshot = await this.collaboration.join(projectId, socket.id, state.user);
       if (!socket.connected || state.lifecycleGeneration !== generation) { this.collaboration.leave(projectId, socket.id); return this.failure('PROJECT_NOT_JOINED', 'Project join was superseded.', 'NONE'); }
      await socket.join(collaborationRoom(projectId));
      state.activeProjectId = projectId;
      state.activeSessionId = snapshot.sessionId;
      await this.emitProtected(projectId, 'project:presence', snapshot.participants);
      return { ok: true, data: snapshot };
    } catch { return this.failure('PROJECT_NOT_FOUND', 'The project was not found.', 'LEAVE'); }
  }

  @SubscribeMessage('project:leave')
  async leaveEvent(@ConnectedSocket() socket: Socket): Promise<CollaborationAck<{ left: true }>> { await this.leave(socket); return { ok: true, data: { left: true } }; }

  @SubscribeMessage('project:resync')
  async resync(@ConnectedSocket() socket: Socket): Promise<CollaborationAck<unknown>> {
    const state = this.state(socket);
    if (!state?.activeProjectId) return this.failure('PROJECT_NOT_JOINED', 'No active project.', 'LEAVE');
    try { await this.authenticator.revalidate(state.user, state.expiresAt); return { ok: true, data: await this.collaboration.resync(state.activeProjectId, socket.id, state.user) }; }
    catch { await this.leave(socket); return this.failure('PROJECT_NOT_FOUND', 'The project was not found.', 'LEAVE'); }
  }

  @SubscribeMessage('project:presence')
  async presence(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<CollaborationAck<unknown>> {
    const state = this.state(socket);
    if (!state?.activeProjectId) return this.failure('PROJECT_NOT_JOINED', 'No active project.', 'LEAVE');
    if (!this.validPresence(body)) return this.failure('INVALID_COMMAND', 'Invalid presence update.', 'NONE');
    if (!this.presenceRateLimiter.allow(socket.id, Date.now())) return this.failure('RATE_LIMITED', 'Presence update rate limit exceeded.', 'NONE');
    try {
      const roster = await this.collaboration.updatePresence(state.activeProjectId, socket.id, state.user, body);
      await this.emitProtected(state.activeProjectId, 'project:presence', roster);
      return { ok: true, data: roster };
    } catch { await this.leave(socket); return this.failure('PROJECT_NOT_FOUND', 'The project was not found.', 'LEAVE'); }
  }

  private async emitProtected(projectId: string, event: string, payload: unknown): Promise<void> {
    const sockets = await this.server.in(collaborationRoom(projectId)).fetchSockets();
    await Promise.all(sockets.map(async (target) => {
      const state = this.state(target as unknown as Socket);
      if (!state) return;
      try { await this.authenticator.revalidate(state.user, state.expiresAt); await this.collaboration.revalidate(projectId, state.user); target.emit(event, payload); }
      catch {
        this.collaboration.leave(projectId, target.id);
        this.server.in(target.id).socketsLeave(collaborationRoom(projectId));
        target.emit('project:revoked', { code: 'PROJECT_NOT_FOUND' });
        target.disconnect(true);
      }
    }));
  }

  private async leave(socket: Socket, increment = true): Promise<void> {
    const state = this.state(socket);
    if (!state) return;
    if (increment) state.lifecycleGeneration += 1;
    const projectId = state.activeProjectId;
    state.activeProjectId = null; state.activeSessionId = null;
    if (projectId) { this.collaboration.leave(projectId, socket.id); await socket.leave(collaborationRoom(projectId)); await this.emitProtected(projectId, 'project:presence', await this.collaboration.roster(projectId)); }
    if (!socket.connected && state.expirationTimer) clearTimeout(state.expirationTimer);
  }

  private async expire(socket: Socket): Promise<void> { await this.leave(socket); socket.emit('auth:expired'); socket.disconnect(true); }
  private state(socket: Socket): SocketState | undefined { return socket.data.collaboration as SocketState | undefined; }
  private failure(code: CollaborationError['error']['code'], message: string, action: CollaborationError['action']): CollaborationError { return { ok: false, error: { code, message }, action }; }
  private allowPresence(state: SocketState): boolean { const now = Date.now(); if (now - state.presenceWindowStartedAt >= 1_000) { state.presenceWindowStartedAt = now; state.presenceCount = 0; } return ++state.presenceCount <= MAX_PRESENCE_UPDATES_PER_SECOND; }
  private validPresence(value: unknown): value is PresenceInput {
    if (!value || typeof value !== 'object' || !('cursor' in value) || !('selectionIds' in value) || !('editingElementId' in value) || !('activity' in value)) return false;
    const input = value as PresenceInput;
    return (input.cursor === null || (Number.isFinite(input.cursor.x) && Number.isFinite(input.cursor.y))) && Array.isArray(input.selectionIds) && input.selectionIds.length <= MAX_SELECTION_IDS && input.selectionIds.every((id) => typeof id === 'string' && id.length <= 64) && (input.editingElementId === null || (typeof input.editingElementId === 'string' && input.editingElementId.length <= 64)) && (input.activity === null || ['idle', 'selecting', 'editing', 'dragging'].includes(input.activity));
  }
}
