import { createUuid, type UmlCommand } from '@examen-sw1/uml-core';
import type { CollaborationSessionMetadata } from './collaboration-session-bridge';
import type { ProjectCommandAck, ProjectCommandApplied, RealtimeCommandEnvelope } from './contracts';

export interface RealtimeCommandTransport {
  submitRealtimeCommand(envelope: RealtimeCommandEnvelope): Promise<ProjectCommandAck>;
}

export type RealtimeCommandSubmission =
  | { accepted: true; commandId: string }
  | { accepted: false; message: string };

/** Keeps local intent out of the document until a later authoritative ingestion path runs. */
export class RealtimeCommandGate {
  private generation = 0;
  private pendingCommandId: string | null = null;
  private pendingTimer: ReturnType<typeof setTimeout> | null = null;
  private uncertain = false;

  constructor(
    private readonly currentMetadata: () => CollaborationSessionMetadata | null,
    private readonly transport: RealtimeCommandTransport,
    private readonly onPendingChange: (pending: boolean) => void = () => undefined,
    private readonly onError: (message: string) => void = () => undefined,
    private readonly ingestApplied: (result: ProjectCommandApplied) => void | Promise<void> = () => undefined,
    private readonly commandIdFactory: () => string = createUuid,
    private readonly recoverAuthoritatively: () => Promise<boolean> = async () => false,
    private readonly acknowledgementTimeoutMs = 5_000,
  ) {}

  submitRealtimeCommand(command: UmlCommand): RealtimeCommandSubmission {
    const metadata = this.currentMetadata();
    if (!metadata) return { accepted: false, message: 'Realtime collaboration is not connected.' };
    if (this.pendingCommandId) return { accepted: false, message: 'A realtime command is already pending.' };

    const commandId = this.commandIdFactory();
    const generation = this.generation;
    this.pendingCommandId = commandId;
    this.uncertain = false;
    this.onPendingChange(true);
    const envelope: RealtimeCommandEnvelope = {
      projectId: metadata.projectId,
      sessionId: metadata.sessionId,
      commandId,
      baseRealtimeVersion: metadata.realtimeVersion,
      baseRevision: metadata.revision,
      command,
    };

    this.pendingTimer = setTimeout(() => this.handleAcknowledgementTimeout(generation, commandId), this.acknowledgementTimeoutMs);
    void this.transport.submitRealtimeCommand(envelope).then((ack) => {
      if (generation !== this.generation || this.pendingCommandId !== commandId) return;
      if (!ack.ok) {
        if (this.uncertain) return;
        this.finishPending();
        this.onError(ack.error.message);
        return;
      }
      void Promise.resolve(this.ingestApplied(ack.data)).catch(() => this.onError('Unable to apply the authoritative realtime command.')).finally(() => {
        if (generation !== this.generation || this.pendingCommandId !== commandId || this.uncertain) return;
        this.finishPending();
      });
    }).catch(() => {
      if (generation !== this.generation || this.pendingCommandId !== commandId || this.uncertain) return;
      this.finishPending();
      this.onError('Unable to submit the realtime command.');
    });

    return { accepted: true, commandId };
  }

  clear(): void {
    this.generation += 1;
    if (this.pendingCommandId) this.finishPending();
    else this.clearPendingTimer();
  }

  private handleAcknowledgementTimeout(generation: number, commandId: string): void {
    if (generation !== this.generation || this.pendingCommandId !== commandId || this.uncertain) return;
    this.clearPendingTimer();
    this.uncertain = true;
    // The original envelope may already be durable, so only a snapshot can resolve it.
    void this.recoverAuthoritatively().then((recovered) => {
      if (generation !== this.generation || this.pendingCommandId !== commandId || !recovered) return;
      this.finishPending();
    }).catch(() => {
      // Keep the gate blocked until a later lifecycle cleanup or authoritative snapshot.
    });
  }

  private finishPending(): void {
    this.clearPendingTimer();
    this.pendingCommandId = null;
    this.uncertain = false;
    this.onPendingChange(false);
  }

  private clearPendingTimer(): void {
    if (this.pendingTimer === null) return;
    clearTimeout(this.pendingTimer);
    this.pendingTimer = null;
  }
}
