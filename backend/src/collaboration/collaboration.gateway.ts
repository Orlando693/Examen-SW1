import { Inject } from '@nestjs/common';
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { IncomingMessage } from 'node:http';
import type { Server, Socket } from 'socket.io';
import { AccessTokenAuthenticator } from '../auth/access-token-authenticator.js';
import type { SafeUser } from '../auth/users.repository.js';
import { CollaborationService } from './collaboration.service.js';
import { collaborationFailure, mapCollaborationException } from './collaboration-error-mapper.js';
import { PresenceRateLimiter } from './presence-rate-limiter.js';
import { CommandRateLimiter } from './command-rate-limiter.js';
import { COLLABORATION_LIMITS } from './collaboration-limits.js';
import { ProjectCommandCoordinator } from './project-command-coordinator.js';
import { collaborationRoom, createAuthoritativeResourceSnapshot, type CollaborationAck, type CollaborationError, type PresenceInput, type ProjectCommandAck, type ProjectResourceUpdated } from './contracts.js';
import type { ProjectResource } from '@examen-sw1/uml-core';

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

@WebSocketGateway({ namespace: '/collaboration', cors: { origin: [...COLLABORATION_LIMITS.allowedOrigins], credentials: false }, maxHttpBufferSize: COLLABORATION_LIMITS.payloadBytes, allowRequest: (request: IncomingMessage, callback: (error: string | null, success: boolean) => void) => callback(null, !request.headers.origin || COLLABORATION_LIMITS.allowedOrigins.includes(request.headers.origin)) })
export class CollaborationGateway {
  @WebSocketServer() private server!: Server;
  constructor(@Inject(AccessTokenAuthenticator) private readonly authenticator: AccessTokenAuthenticator, @Inject(CollaborationService) private readonly collaboration: CollaborationService, @Inject(PresenceRateLimiter) private readonly presenceRateLimiter: PresenceRateLimiter = new PresenceRateLimiter(), @Inject(ProjectCommandCoordinator) private readonly commands?: ProjectCommandCoordinator, @Inject(CommandRateLimiter) private readonly commandRateLimiter: CommandRateLimiter = new CommandRateLimiter()) {}

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

  async emitResourceUpdated(projectId: string, sessionId: string, resource: ProjectResource): Promise<void> {
    const snapshot = createAuthoritativeResourceSnapshot(resource);
    const update: ProjectResourceUpdated = { projectId, sessionId, ...snapshot };
    await this.emitProtected(projectId, 'project:resource-updated', update);
  }

  async terminateProject(projectId: string): Promise<void> {
    const targets = await this.server.in(collaborationRoom(projectId)).fetchSockets();
    this.collaboration.terminate(projectId);
    for (const target of targets) {
      const state = this.state(target as unknown as Socket);
      if (state?.activeProjectId === projectId) {
        state.lifecycleGeneration += 1;
        state.activeProjectId = null;
        state.activeSessionId = null;
        if (state.expirationTimer) clearTimeout(state.expirationTimer);
        state.expirationTimer = null;
      }
      this.presenceRateLimiter.remove(target.id);
      this.commandRateLimiter.remove(target.id);
      this.server.in(target.id).socketsLeave(collaborationRoom(projectId));
      target.emit('project:revoked', this.failure('PROJECT_NOT_FOUND'));
      target.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket): void { this.presenceRateLimiter.remove(socket.id); this.commandRateLimiter.remove(socket.id); void this.leave(socket); }

  @SubscribeMessage('project:join')
  async join(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<CollaborationAck<unknown>> {
    const projectId = typeof body === 'object' && body !== null && 'projectId' in body && typeof body.projectId === 'string' ? body.projectId : null;
    if (!projectId) return this.failure('INVALID_COMMAND');
    const state = this.state(socket);
    if (!state) return this.failure('AUTHENTICATION_REQUIRED');
    const generation = ++state.lifecycleGeneration;
    await this.leave(socket, false);
    try {
      await this.authenticator.revalidate(state.user, state.expiresAt);
      const snapshot = await this.collaboration.join(projectId, socket.id, state.user);
        if (!socket.connected || state.lifecycleGeneration !== generation) { this.collaboration.leave(projectId, socket.id); return this.failure('PROJECT_NOT_JOINED'); }
      await socket.join(collaborationRoom(projectId));
      state.activeProjectId = projectId;
      state.activeSessionId = snapshot.sessionId;
      await this.emitProtected(projectId, 'project:presence', snapshot.participants);
      return { ok: true, data: snapshot };
    } catch (error) { return mapCollaborationException(error, state.expiresAt); }
  }

  @SubscribeMessage('project:leave')
  async leaveEvent(@ConnectedSocket() socket: Socket): Promise<CollaborationAck<{ left: true }>> { await this.leave(socket); return { ok: true, data: { left: true } }; }

  @SubscribeMessage('project:resync')
  async resync(@ConnectedSocket() socket: Socket): Promise<CollaborationAck<unknown>> {
    const state = this.state(socket);
    if (!state?.activeProjectId) return this.failure('PROJECT_NOT_JOINED');
    try { await this.authenticator.revalidate(state.user, state.expiresAt); return { ok: true, data: await this.collaboration.resync(state.activeProjectId, socket.id, state.user) }; }
    catch (error) { await this.leave(socket); return mapCollaborationException(error, state.expiresAt); }
  }

  @SubscribeMessage('project:presence')
  async presence(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<CollaborationAck<unknown>> {
    const state = this.state(socket);
    if (!state?.activeProjectId) return this.failure('PROJECT_NOT_JOINED');
    if (!this.validPresence(body)) return this.failure('INVALID_COMMAND');
    if (!this.presenceRateLimiter.allow(socket.id, Date.now())) return this.failure('RATE_LIMITED');
    try {
      const roster = await this.collaboration.updatePresence(state.activeProjectId, socket.id, state.user, body);
      await this.emitProtected(state.activeProjectId, 'project:presence', roster);
      return { ok: true, data: roster };
    } catch (error) { await this.leave(socket); return mapCollaborationException(error, state.expiresAt); }
  }

  @SubscribeMessage('project:command')
  async command(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<ProjectCommandAck> {
    const state = this.state(socket);
    if (!state) return this.failure('AUTHENTICATION_REQUIRED');
    if (!this.commands) return this.failure('INTERNAL_ERROR');
    if (!this.commandRateLimiter.allow(socket.id, Date.now())) return this.failure('RATE_LIMITED');
    let result: ProjectCommandAck;
    try { result = await this.commands.execute({ socketId: socket.id, user: state.user, expiresAt: state.expiresAt, activeProjectId: state.activeProjectId, activeSessionId: state.activeSessionId, envelope: body }); }
    catch (error) { return mapCollaborationException(error, state.expiresAt); }
    if (result.ok && result.status === 'APPLIED') await this.emitProtected(result.data.projectId, 'project:command-applied', result.data, socket.id);
    return result;
  }

  private async emitProtected(projectId: string, event: string, payload: unknown, excludedSocketId?: string): Promise<void> {
    const sockets = await this.server.in(collaborationRoom(projectId)).fetchSockets();
    await Promise.all(sockets.map(async (target) => {
      if (target.id === excludedSocketId) return;
      const state = this.state(target as unknown as Socket);
      if (!state) return;
      try { await this.authenticator.revalidate(state.user, state.expiresAt); await this.collaboration.revalidate(projectId, state.user); target.emit(event, payload); }
      catch {
        this.collaboration.leave(projectId, target.id);
        this.server.in(target.id).socketsLeave(collaborationRoom(projectId));
        target.emit('project:revoked', this.failure('PROJECT_NOT_FOUND'));
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
  private failure(code: CollaborationError['error']['code']): CollaborationError { return collaborationFailure(code); }
  private validPresence(value: unknown): value is PresenceInput {
    if (!value || typeof value !== 'object' || !('cursor' in value) || !('selectionIds' in value) || !('editingElementId' in value) || !('activity' in value)) return false;
    const input = value as PresenceInput;
    return Object.keys(input).length === 4 && (input.cursor === null || (Number.isFinite(input.cursor.x) && Number.isFinite(input.cursor.y))) && Array.isArray(input.selectionIds) && input.selectionIds.length <= COLLABORATION_LIMITS.presenceSelectionCapacity && input.selectionIds.every((id) => typeof id === 'string' && id.length <= COLLABORATION_LIMITS.presenceIdentifierLength) && (input.editingElementId === null || (typeof input.editingElementId === 'string' && input.editingElementId.length <= COLLABORATION_LIMITS.presenceIdentifierLength)) && (input.activity === null || ['idle', 'selecting', 'editing', 'dragging'].includes(input.activity));
  }
}
