import type { ProjectResource } from '@examen-sw1/uml-core';
import { AuthoritativeCommandIngestionController } from './authoritative-command-ingestion-controller';
import { sha256Canonical } from './canonical-digest';
import type { CollaborationAck, CollaborationParticipant, CollaborationSnapshot, ProjectCommandApplied, ProjectResourceUpdated } from './contracts';

export interface CollaborationSessionMetadata {
  projectId: string;
  sessionId: string;
  realtimeVersion: number;
  storageVersion: number;
  revision: number;
  documentDigest: string | null;
}
export const JOIN_BUFFER_CAPACITY = 128;
type BufferedPresence = { projectId: string; participants: CollaborationParticipant[] };
type BufferedApplied = { projectId: string; applied: ProjectCommandApplied };

export interface CollaborationSessionClient {
  joinProject(projectId: string): Promise<CollaborationAck<CollaborationSnapshot>>;
  resync(): Promise<CollaborationAck<CollaborationSnapshot>>;
}

export class CollaborationSessionBridge {
  private generation = 0;
  private metadata: CollaborationSessionMetadata | null = null;
  private joiningProjectId: string | null = null;
  private readonly joinBuffer: BufferedPresence[] = [];
  private readonly appliedJoinBuffer: BufferedApplied[] = [];
  private overflowedGeneration: number | null = null;
  private recoveryInFlight: Promise<boolean> | null = null;
  private readonly ingestion: AuthoritativeCommandIngestionController;

  constructor(private readonly client: CollaborationSessionClient, private readonly installResource: (resource: ProjectResource) => void, private readonly installRoster: (projectId: string, participants: CollaborationParticipant[]) => void = () => undefined) {
    this.ingestion = new AuthoritativeCommandIngestionController({
      onApplied: ({ baseline }) => {
        if (!baseline || baseline.generation !== this.generation) return;
        this.installResource(baseline.resource);
        this.installMetadata(baseline);
      },
      onRecoveryRequired: () => {
        const metadata = this.metadata;
        if (metadata) void this.recoverCurrent(this.generation, metadata.projectId);
      },
    });
  }

  get session(): CollaborationSessionMetadata | null { return this.metadata; }

  async join(projectId: string): Promise<{ ack: CollaborationAck<CollaborationSnapshot>; applied: boolean }> {
    const generation = ++this.generation;
    this.metadata = null; this.joiningProjectId = projectId; this.joinBuffer.length = 0; this.appliedJoinBuffer.length = 0;
    const ack = await this.client.joinProject(projectId);
    const applied = ack.ok && await this.installIfCurrent(generation, projectId, ack.data);
    if (applied && this.overflowedGeneration === generation) await this.recoverCurrent(generation, projectId);
    if (!applied) this.discardJoinBuffer();
    return { ack, applied };
  }

  receivePresence(projectId: string, participants: CollaborationParticipant[]): 'APPLIED' | 'BUFFERED' | 'OVERFLOW' | 'IGNORED' {
    if (this.metadata?.projectId === projectId) { this.installRoster(projectId, participants); return 'APPLIED'; }
    if (this.joiningProjectId !== projectId) return 'IGNORED';
    if (this.overflowedGeneration === this.generation) return 'OVERFLOW';
    if (this.joinBuffer.length >= JOIN_BUFFER_CAPACITY) { this.joinBuffer.length = 0; this.overflowedGeneration = this.generation; return 'OVERFLOW'; }
    this.joinBuffer.push({ projectId, participants: [...participants] }); return 'BUFFERED';
  }

  receiveApplied(applied: ProjectCommandApplied): Promise<void> {
    if (this.metadata?.projectId === applied.projectId) {
      return this.ingestion.ingest(this.generation, applied).then(() => undefined);
    }
    if (this.joiningProjectId !== applied.projectId || this.overflowedGeneration === this.generation) return Promise.resolve();
    if (this.appliedJoinBuffer.length >= JOIN_BUFFER_CAPACITY) {
      this.appliedJoinBuffer.length = 0;
      this.joinBuffer.length = 0;
      this.overflowedGeneration = this.generation;
      return Promise.resolve();
    }
    if (!this.appliedJoinBuffer.some((entry) => entry.applied.commandId === applied.commandId)) {
      this.appliedJoinBuffer.push({ projectId: applied.projectId, applied });
    }
    return Promise.resolve();
  }

  async receiveResourceUpdated(update: ProjectResourceUpdated): Promise<'APPLIED' | 'IGNORED' | 'RECOVERING'> {
    const metadata = this.metadata;
    if (!metadata || update.projectId !== metadata.projectId || update.sessionId !== metadata.sessionId) return 'IGNORED';
    if (update.resource.project.id !== metadata.projectId || update.resource.project.revision !== metadata.revision) {
      void this.recoverCurrent(this.generation, metadata.projectId);
      return 'RECOVERING';
    }
    if (update.resource.storageVersion < metadata.storageVersion) return 'IGNORED';
    if (update.resource.storageVersion === metadata.storageVersion) {
      if (update.documentDigest === metadata.documentDigest) return 'IGNORED';
      void this.recoverCurrent(this.generation, metadata.projectId);
      return 'RECOVERING';
    }
    if (update.resource.storageVersion !== metadata.storageVersion + 1 || await sha256Canonical(update.resource.project) !== update.documentDigest) {
      void this.recoverCurrent(this.generation, metadata.projectId);
      return 'RECOVERING';
    }
    if (metadata !== this.metadata) return 'IGNORED';
    this.installResource(update.resource);
    this.metadata = { ...metadata, storageVersion: update.resource.storageVersion, documentDigest: update.documentDigest };
    return 'APPLIED';
  }

  async resync(): Promise<{ ack: CollaborationAck<CollaborationSnapshot>; applied: boolean }> {
    const projectId = this.metadata?.projectId;
    if (!projectId) return { ack: { ok: false, error: { code: 'PROJECT_NOT_JOINED', message: 'No active project.' }, action: 'LEAVE' }, applied: false };
    const generation = this.generation;
    const ack = await this.client.resync();
    return { ack, applied: ack.ok && await this.installIfCurrent(generation, projectId, ack.data) };
  }

  /** Recovery always installs the server snapshot before releasing an uncertain command gate. */
  recover(): Promise<boolean> {
    const metadata = this.metadata;
    return metadata ? this.recoverCurrent(this.generation, metadata.projectId) : Promise.resolve(false);
  }

  clear(): void { this.generation += 1; this.metadata = null; this.overflowedGeneration = null; this.recoveryInFlight = null; this.discardJoinBuffer(); }

  private async installIfCurrent(generation: number, projectId: string, snapshot: CollaborationSnapshot): Promise<boolean> {
    if (generation !== this.generation || snapshot.projectId !== projectId) return false;
    const installed = await this.ingestion.installSnapshot(generation, snapshot);
    if (generation !== this.generation || !installed.baseline) return false;
    // The store sees only a digest-verified authoritative baseline.
    this.installResource(installed.baseline.resource);
    this.installMetadata(installed.baseline);
    this.installRoster(snapshot.projectId, snapshot.participants);
    const buffered = this.overflowedGeneration === generation ? [] : this.joinBuffer.splice(0);
    const bufferedApplied = this.overflowedGeneration === generation ? [] : this.appliedJoinBuffer.splice(0);
    this.joiningProjectId = null;
    for (const event of buffered) if (event.projectId === snapshot.projectId) this.installRoster(event.projectId, event.participants);
    for (const event of bufferedApplied) if (event.projectId === snapshot.projectId) await this.ingestion.ingest(generation, event.applied);
    return true;
  }

  private discardJoinBuffer(): void { this.joiningProjectId = null; this.joinBuffer.length = 0; this.appliedJoinBuffer.length = 0; }

  private async recoverCurrent(generation: number, projectId: string): Promise<boolean> {
    if (this.recoveryInFlight) return this.recoveryInFlight;
    this.recoveryInFlight = this.client.resync().then(async (ack) => {
      if (!ack.ok || generation !== this.generation || ack.data.projectId !== projectId) return false;
      const installed = await this.installIfCurrent(generation, projectId, ack.data);
      if (!installed) return false;
      this.overflowedGeneration = null;
      return true;
    }).catch(() => false).finally(() => { if (generation === this.generation) this.recoveryInFlight = null; });
    return this.recoveryInFlight;
  }

  private installMetadata(baseline: { projectId: string; sessionId: string; realtimeVersion: number; storageVersion: number; revision: number; documentDigest: string }): void {
    this.metadata = { projectId: baseline.projectId, sessionId: baseline.sessionId, realtimeVersion: baseline.realtimeVersion, storageVersion: baseline.storageVersion, revision: baseline.revision, documentDigest: baseline.documentDigest };
  }

}
