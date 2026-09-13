import type { ProjectResource } from '@examen-sw1/uml-core';
import type { CollaborationAck, CollaborationParticipant, CollaborationSnapshot } from './contracts';

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

export interface CollaborationSessionClient {
  joinProject(projectId: string): Promise<CollaborationAck<CollaborationSnapshot>>;
  resync(): Promise<CollaborationAck<CollaborationSnapshot>>;
}

export class CollaborationSessionBridge {
  private generation = 0;
  private metadata: CollaborationSessionMetadata | null = null;
  private joiningProjectId: string | null = null;
  private readonly joinBuffer: BufferedPresence[] = [];
  private overflowedGeneration: number | null = null;
  private recoveryInFlight: Promise<void> | null = null;

  constructor(private readonly client: CollaborationSessionClient, private readonly installResource: (resource: ProjectResource) => void, private readonly installRoster: (projectId: string, participants: CollaborationParticipant[]) => void = () => undefined) {}

  get session(): CollaborationSessionMetadata | null { return this.metadata; }

  async join(projectId: string): Promise<{ ack: CollaborationAck<CollaborationSnapshot>; applied: boolean }> {
    const generation = ++this.generation;
    this.metadata = null; this.joiningProjectId = projectId; this.joinBuffer.length = 0;
    const ack = await this.client.joinProject(projectId);
    const applied = ack.ok && this.installIfCurrent(generation, projectId, ack.data);
    if (applied && this.overflowedGeneration === generation) await this.recover(generation, projectId);
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

  async resync(): Promise<{ ack: CollaborationAck<CollaborationSnapshot>; applied: boolean }> {
    const projectId = this.metadata?.projectId;
    if (!projectId) return { ack: { ok: false, error: { code: 'PROJECT_NOT_JOINED', message: 'No active project.' }, action: 'LEAVE' }, applied: false };
    const generation = this.generation;
    const ack = await this.client.resync();
    return { ack, applied: ack.ok && this.installIfCurrent(generation, projectId, ack.data) };
  }

  clear(): void { this.generation += 1; this.metadata = null; this.overflowedGeneration = null; this.recoveryInFlight = null; this.discardJoinBuffer(); }

  private installIfCurrent(generation: number, projectId: string, snapshot: CollaborationSnapshot): boolean {
    if (generation !== this.generation || snapshot.projectId !== projectId) return false;
    this.installResource(snapshot.resource);
    this.metadata = {
      projectId: snapshot.projectId,
      sessionId: snapshot.sessionId,
      realtimeVersion: snapshot.realtimeVersion,
      storageVersion: snapshot.resource.storageVersion,
      revision: snapshot.resource.project.revision,
      documentDigest: snapshot.documentDigest,
    };
    this.installRoster(snapshot.projectId, snapshot.participants);
    const buffered = this.overflowedGeneration === generation ? [] : this.joinBuffer.splice(0);
    this.joiningProjectId = null;
    for (const event of buffered) if (event.projectId === snapshot.projectId) this.installRoster(event.projectId, event.participants);
    return true;
  }

  private discardJoinBuffer(): void { this.joiningProjectId = null; this.joinBuffer.length = 0; }

  private async recover(generation: number, projectId: string): Promise<void> {
    if (this.recoveryInFlight) return this.recoveryInFlight;
    this.recoveryInFlight = this.client.resync().then((ack) => {
      if (!ack.ok || generation !== this.generation || ack.data.projectId !== projectId) return;
      this.installResource(ack.data.resource);
      this.metadata = { projectId: ack.data.projectId, sessionId: ack.data.sessionId, realtimeVersion: ack.data.realtimeVersion, storageVersion: ack.data.resource.storageVersion, revision: ack.data.resource.project.revision, documentDigest: ack.data.documentDigest };
      this.installRoster(ack.data.projectId, ack.data.participants);
      this.overflowedGeneration = null;
    }).finally(() => { if (generation === this.generation) this.recoveryInFlight = null; });
    return this.recoveryInFlight;
  }
}
