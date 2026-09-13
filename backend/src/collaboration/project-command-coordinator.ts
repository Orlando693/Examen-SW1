import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { UmlCommandBus, validateProjectDocument, type ProjectResource } from '@examen-sw1/uml-core';
import { AccessTokenAuthenticator } from '../auth/access-token-authenticator.js';
import type { SafeUser } from '../auth/users.repository.js';
import { toProjectResource } from '../persistence/project-persistence.mapper.js';
import { ProjectsRepository } from '../projects/projects.repository.js';
import { ProjectsService } from '../projects/projects.service.js';
import { digestCommandIntent, sha256Canonical } from './canonical-digest.js';
import { CollaborationSessionManager, type ProjectSession } from './collaboration-session.manager.js';
import type { CollaborationAction, CollaborationErrorCode, ProjectCommandAck } from './contracts.js';
import { createProjectCommandApplied } from './project-command-applied.js';
import { ProjectMutationCoordinator } from './project-mutation-coordinator.js';
import { decodeRealtimeCommandEnvelope, type RealtimeCommandEnvelope } from './realtime-command-decoder.js';
import { normalizeRealtimeCommand } from './realtime-command-normalizer.js';

const DEDUPE_CAPACITY = 512;
const DEDUPE_TTL_MS = 10 * 60_000;

export interface ExecuteProjectCommandInput {
  socketId: string;
  user: SafeUser;
  expiresAt: number;
  activeProjectId: string | null;
  activeSessionId: string | null;
  envelope: unknown;
}

@Injectable()
export class ProjectCommandCoordinator {
  private beforeCasHook: (() => void | Promise<void>) | null = null;
  private postCasHook: (() => void | Promise<void>) | null = null;

  constructor(
    @Inject(AccessTokenAuthenticator) private readonly authenticator: AccessTokenAuthenticator,
    @Inject(ProjectsService) private readonly projects: ProjectsService,
    @Inject(ProjectsRepository) private readonly repository: ProjectsRepository,
    @Inject(ProjectMutationCoordinator) private readonly coordinator: ProjectMutationCoordinator,
    @Inject(CollaborationSessionManager) private readonly sessions: CollaborationSessionManager,
  ) {}

  setBeforeCasHookForTest(hook: (() => void | Promise<void>) | null): void { this.beforeCasHook = hook; }
  setPostCasHookForTest(hook: (() => void | Promise<void>) | null): void { this.postCasHook = hook; }

  async execute(input: ExecuteProjectCommandInput): Promise<ProjectCommandAck> {
    const decoded = decodeRealtimeCommandEnvelope(input.envelope);
    if (!decoded.ok) return this.failure('INVALID_COMMAND', 'Invalid command.', 'NONE');
    return this.coordinator.run(decoded.data.projectId, () => this.executeQueued(input, decoded.data));
  }

  private async executeQueued(input: ExecuteProjectCommandInput, envelope: RealtimeCommandEnvelope): Promise<ProjectCommandAck> {
    try {
      await this.authenticator.revalidate(input.user, input.expiresAt);
      await this.projects.get(input.user, envelope.projectId);
    } catch {
      return this.failure(Date.now() >= input.expiresAt ? 'AUTH_EXPIRED' : 'PROJECT_NOT_FOUND', Date.now() >= input.expiresAt ? 'Authentication expired.' : 'The project was not found.', Date.now() >= input.expiresAt ? 'REAUTHENTICATE' : 'LEAVE');
    }
    if (input.activeProjectId !== envelope.projectId) return this.failure('PROJECT_NOT_JOINED', 'Project is not joined.', 'LEAVE');
    const session = this.sessions.get(envelope.projectId);
    if (!session || session.poisoned || !session.socketIds.has(input.socketId) || input.activeSessionId !== session.sessionId || envelope.sessionId !== session.sessionId) return this.failure('STALE_SESSION', 'Session is stale.', 'RESYNC');

    const intentDigest = digestCommandIntent({ ...envelope, actorUserId: input.user.id });
    this.pruneDedupe(session);
    const duplicate = session.dedupe.get(envelope.commandId);
    if (duplicate) {
      if (duplicate.actorUserId !== input.user.id || duplicate.intentDigest !== intentDigest) return this.failure('INVALID_COMMAND', 'Invalid command.', 'NONE');
      return { ok: true, status: 'DUPLICATE', data: duplicate.result };
    }
    if (envelope.baseRealtimeVersion !== session.realtimeVersion) return this.failure('STALE_REALTIME_VERSION', 'Realtime version is stale.', 'RESYNC');

    let resource: ProjectResource;
    try { resource = await this.projects.get(input.user, envelope.projectId); }
    catch { return this.failure('PROJECT_NOT_FOUND', 'The project was not found.', 'LEAVE'); }
    if (envelope.baseRevision !== resource.project.revision) return this.failure('STALE_DOCUMENT_REVISION', 'Document revision is stale.', 'RESYNC');

    const normalized = normalizeRealtimeCommand(envelope.command, resource, { appliedAt: new Date().toISOString(), generatedIds: Array.from({ length: 1_001 }, () => randomUUID()) });
    if (!normalized.ok) return this.failure('INVALID_COMMAND', 'Invalid command.', 'NONE');
    const executed = new UmlCommandBus().execute(resource.project, normalized.data.command, { now: normalized.data.appliedAt });
    if (!executed.ok) return this.failure(executed.reason === 'VALIDATION_FAILED' ? 'SEMANTIC_VALIDATION_FAILED' : 'DOMAIN_COMMAND_REJECTED', 'Command was rejected.', 'NONE');
    if (validateProjectDocument(executed.document).hasErrors) return this.failure('SEMANTIC_VALIDATION_FAILED', 'Command was rejected.', 'NONE');

    const candidate = { ...resource, project: executed.document };
    const persisted = await this.persistWithOneMetadataRetry(input, envelope, resource, candidate, session);
    if (persisted === undefined) {
      this.sessions.invalidate(envelope.projectId, session.sessionId);
      return this.failure('PROJECT_NOT_FOUND', 'The project was not found.', 'LEAVE');
    }
    if (!persisted) return this.failure('CAS_CONFLICT', 'Project state changed.', 'RESYNC');

    // CAS returning the row is the durable commit point. Never try to undo it.
    try {
      await this.postCasHook?.();
      const result = createProjectCommandApplied({ projectId: envelope.projectId, sessionId: session.sessionId, commandId: envelope.commandId, actorUserId: input.user.id, baseRealtimeVersion: envelope.baseRealtimeVersion, resultingRealtimeVersion: session.realtimeVersion + 1, baseRevision: envelope.baseRevision, normalized: normalized.data, resultingResource: persisted });
      session.realtimeVersion = result.resultingRealtimeVersion;
      session.dedupe.set(envelope.commandId, { actorUserId: input.user.id, intentDigest, result, createdAt: Date.now() });
      this.pruneDedupe(session);
      return { ok: true, status: 'APPLIED', data: result };
    } catch {
      this.sessions.invalidate(envelope.projectId, session.sessionId);
      return this.failure('INTERNAL_STATE_UNCERTAIN', 'Project state must be resynchronized.', 'RESYNC');
    }
  }

  private async persistWithOneMetadataRetry(input: ExecuteProjectCommandInput, envelope: RealtimeCommandEnvelope, original: ProjectResource, candidate: ProjectResource, session: ProjectSession): Promise<ProjectResource | null | undefined> {
    const write = async (storageVersion: number) => {
      await this.authenticator.revalidate(input.user, input.expiresAt);
      await this.beforeCasHook?.();
      return this.repository.updateAndReturnIfAccessibleVersion(envelope.projectId, input.user.id, storageVersion, { revision: candidate.project.revision, model: candidate.project.model as never, layout: candidate.project.layout as never, updatedAt: new Date(candidate.project.timestamps.updatedAt) });
    };
    let row;
    try { row = await write(original.storageVersion); } catch { return null; }
    if (row) return toProjectResource(row);
    let reloaded: ProjectResource;
    try { reloaded = await this.projects.get(input.user, envelope.projectId); } catch { return undefined; }
    if (session.sessionId !== envelope.sessionId || session.realtimeVersion !== envelope.baseRealtimeVersion || reloaded.project.revision !== original.project.revision || sha256Canonical({ model: reloaded.project.model, layout: reloaded.project.layout }) !== sha256Canonical({ model: original.project.model, layout: original.project.layout })) {
      this.sessions.invalidate(envelope.projectId, session.sessionId);
      return null;
    }
    try { row = await write(reloaded.storageVersion); } catch { return null; }
    if (row) return toProjectResource(row);
    this.sessions.invalidate(envelope.projectId, session.sessionId);
    return null;
  }

  private pruneDedupe(session: ProjectSession): void {
    const cutoff = Date.now() - DEDUPE_TTL_MS;
    for (const [key, entry] of session.dedupe) if (entry.createdAt < cutoff) session.dedupe.delete(key);
    while (session.dedupe.size > DEDUPE_CAPACITY) session.dedupe.delete(session.dedupe.keys().next().value!);
  }

  private failure(code: CollaborationErrorCode, message: string, action: CollaborationAction): ProjectCommandAck { return { ok: false, error: { code, message }, action }; }
}
