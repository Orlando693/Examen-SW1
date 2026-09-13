import { UmlCommandBus, type ProjectResource } from '@examen-sw1/uml-core';
import { sha256Canonical } from './canonical-digest';
import type { CollaborationSnapshot, ProjectCommandApplied } from './contracts';

export const APPLIED_EVENT_CAPACITY = 128;

export interface AuthoritativeCommandBaseline {
  generation: number;
  projectId: string;
  sessionId: string;
  realtimeVersion: number;
  revision: number;
  storageVersion: number;
  documentDigest: string;
  resource: ProjectResource;
}

export type AuthoritativeCommandClassification =
  | 'NEXT'
  | 'OLD'
  | 'GAP'
  | 'DIFFERENT_SESSION'
  | 'STALE_GENERATION'
  | 'MISMATCH';

export interface AuthoritativeCommandIngestionResult {
  classification: AuthoritativeCommandClassification;
  applied: boolean;
  recoveryRequested: boolean;
  baseline: AuthoritativeCommandBaseline | null;
}

export interface AuthoritativeCommandIngestionControllerOptions {
  onApplied?: (metadata: AuthoritativeCommandIngestionResult) => void;
  onRecoveryRequired?: (metadata: AuthoritativeCommandIngestionResult) => void;
  digest?: (document: ProjectResource['project']) => Promise<string>;
}

/**
 * Pure frontend authority boundary. Consumers later decide how to install its
 * accepted resource; this controller never writes a store or emits transport events.
 */
export class AuthoritativeCommandIngestionController {
  private baseline: AuthoritativeCommandBaseline | null = null;
  private queue: Promise<void> = Promise.resolve();
  private recoveryGeneration: number | null = null;
  private readonly consumedCommandIds = new Map<string, true>();
  private readonly bufferedResults: ProjectCommandApplied[] = [];

  constructor(private readonly options: AuthoritativeCommandIngestionControllerOptions = {}) {}

  get currentBaseline(): AuthoritativeCommandBaseline | null {
    return this.baseline;
  }

  installSnapshot(generation: number, snapshot: CollaborationSnapshot): Promise<AuthoritativeCommandIngestionResult> {
    return this.enqueue(async () => {
      if (this.baseline && generation < this.baseline.generation) return this.result('STALE_GENERATION', false);
      const digest = await this.digest(snapshot.resource.project);
      if (snapshot.documentDigest !== null && digest !== snapshot.documentDigest) return this.recover('MISMATCH');

      this.baseline = {
        generation,
        projectId: snapshot.projectId,
        sessionId: snapshot.sessionId,
        realtimeVersion: snapshot.realtimeVersion,
        revision: snapshot.resource.project.revision,
        storageVersion: snapshot.resource.storageVersion,
        documentDigest: digest,
        resource: structuredClone(snapshot.resource),
      };
      this.recoveryGeneration = null;
      this.consumedCommandIds.clear();
      return this.replayBuffered();
    });
  }

  recoverFromSnapshot(generation: number, snapshot: CollaborationSnapshot): Promise<AuthoritativeCommandIngestionResult> {
    return this.installSnapshot(generation, snapshot);
  }

  ingest(generation: number, applied: ProjectCommandApplied): Promise<AuthoritativeCommandIngestionResult> {
    return this.enqueue(() => this.ingestCurrent(generation, applied));
  }

  clear(generation: number): void {
    if (this.baseline && generation < this.baseline.generation) return;
    this.baseline = null;
    this.recoveryGeneration = null;
    this.consumedCommandIds.clear();
    this.bufferedResults.length = 0;
  }

  private async ingestCurrent(generation: number, applied: ProjectCommandApplied): Promise<AuthoritativeCommandIngestionResult> {
    const baseline = this.baseline;
    if (!baseline || generation !== baseline.generation) return this.result('STALE_GENERATION', false);
    if (applied.projectId !== baseline.projectId) return this.result('STALE_GENERATION', false);
    if (applied.sessionId !== baseline.sessionId) return this.recover('DIFFERENT_SESSION');
    if (applied.resultingRealtimeVersion <= baseline.realtimeVersion || this.consumedCommandIds.has(applied.commandId)) return this.result('OLD', false);
    if (applied.baseRealtimeVersion !== baseline.realtimeVersion || applied.resultingRealtimeVersion !== baseline.realtimeVersion + 1) {
      this.buffer(applied);
      return this.recover('GAP');
    }
    if (applied.baseRevision !== baseline.revision || applied.resultingRevision !== baseline.revision + 1) return this.recover('MISMATCH');

    const candidate = new UmlCommandBus().execute(baseline.resource.project, applied.normalizedCommand, { now: applied.appliedAt });
    if (!candidate.ok || candidate.document.revision !== applied.resultingRevision) return this.recover('MISMATCH');

    let digest: string;
    try {
      digest = await this.digest(candidate.document);
    } catch {
      return this.recover('MISMATCH');
    }
    if (this.baseline !== baseline || generation !== baseline.generation) return this.result('STALE_GENERATION', false);
    if (digest !== applied.resultingDocumentDigest) return this.recover('MISMATCH');

    this.baseline = {
      ...baseline,
      realtimeVersion: applied.resultingRealtimeVersion,
      revision: applied.resultingRevision,
      storageVersion: applied.storageVersion,
      documentDigest: digest,
      resource: { ...baseline.resource, project: candidate.document, storageVersion: applied.storageVersion },
    };
    this.consume(applied.commandId);
    const result = this.result('NEXT', true);
    this.options.onApplied?.(result);
    return result;
  }

  private async replayBuffered(): Promise<AuthoritativeCommandIngestionResult> {
    const buffered = this.bufferedResults.splice(0).sort((left, right) => left.resultingRealtimeVersion - right.resultingRealtimeVersion);
    let result = this.result('NEXT', false);
    for (const applied of buffered) {
      result = await this.ingestCurrent(this.baseline!.generation, applied);
      if (result.classification !== 'NEXT' || !result.applied) break;
    }
    return result;
  }

  private recover(classification: Exclude<AuthoritativeCommandClassification, 'NEXT' | 'OLD' | 'STALE_GENERATION'>): AuthoritativeCommandIngestionResult {
    const shouldRecover = this.baseline !== null && this.recoveryGeneration !== this.baseline.generation;
    if (shouldRecover) this.recoveryGeneration = this.baseline!.generation;
    const result = this.result(classification, false, shouldRecover);
    if (shouldRecover) this.options.onRecoveryRequired?.(result);
    return result;
  }

  private result(classification: AuthoritativeCommandClassification, applied: boolean, recoveryRequested = false): AuthoritativeCommandIngestionResult {
    return { classification, applied, recoveryRequested, baseline: this.baseline };
  }

  private consume(commandId: string): void {
    this.consumedCommandIds.delete(commandId);
    this.consumedCommandIds.set(commandId, true);
    if (this.consumedCommandIds.size > APPLIED_EVENT_CAPACITY) this.consumedCommandIds.delete(this.consumedCommandIds.keys().next().value!);
  }

  private buffer(applied: ProjectCommandApplied): void {
    if (this.bufferedResults.some((entry) => entry.commandId === applied.commandId)) return;
    if (this.bufferedResults.length >= APPLIED_EVENT_CAPACITY) this.bufferedResults.shift();
    this.bufferedResults.push(applied);
  }

  private digest(document: ProjectResource['project']): Promise<string> {
    return (this.options.digest ?? sha256Canonical)(document);
  }

  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const task = this.queue.then(work, work);
    this.queue = task.then(() => undefined, () => undefined);
    return task;
  }
}
