import { describe, expect, it, vi } from 'vitest';
import { RealtimeCommandGate } from './realtime-command-gate';
import type { RealtimeCommandEnvelope } from './contracts';

const command = { type: 'RenameClass', classId: 'class-a', name: 'Renamed' } as const;
const metadata = { projectId: 'project-a', sessionId: 'session-a', realtimeVersion: 4, revision: 7, storageVersion: 3, documentDigest: 'digest' };

describe('RealtimeCommandGate', () => {
  it('keeps the submission pending until authoritative ACK ingestion completes', async () => {
    let acknowledge: ((value: never) => void) | undefined;
    const submitRealtimeCommand = vi.fn(() => new Promise<never>((resolve) => { acknowledge = resolve; }));
    const pending = vi.fn();
    const gate = new RealtimeCommandGate(() => metadata, { submitRealtimeCommand }, pending, undefined, undefined, () => 'command-1');

    expect(gate.submitRealtimeCommand(command)).toEqual({ accepted: true, commandId: 'command-1' });
    expect(submitRealtimeCommand).toHaveBeenCalledWith({ projectId: 'project-a', sessionId: 'session-a', commandId: 'command-1', baseRealtimeVersion: 4, baseRevision: 7, command });
    expect(gate.submitRealtimeCommand(command)).toEqual({ accepted: false, message: 'A realtime command is already pending.' });
    expect(pending).toHaveBeenCalledWith(true);

    acknowledge!({ ok: true, status: 'APPLIED', data: {} } as never);
    await vi.waitFor(() => expect(pending).toHaveBeenLastCalledWith(false));
  });

  it('clears rejected transport work, reports errors, and ignores stale ACKs after a generation switch', async () => {
    const responses: Array<(ack: never) => void> = [];
    const submitRealtimeCommand = vi.fn(() => new Promise<never>((resolve) => responses.push(resolve)));
    const pending = vi.fn();
    const errors = vi.fn();
    const gate = new RealtimeCommandGate(() => metadata, { submitRealtimeCommand }, pending, errors, undefined, () => `command-${responses.length + 1}`);

    gate.submitRealtimeCommand(command);
    gate.clear();
    responses[0]!({ ok: false, error: { code: 'STALE_SESSION', message: 'Stale session.' }, action: 'RESYNC' } as never);
    await Promise.resolve();
    expect(errors).not.toHaveBeenCalled();

    gate.submitRealtimeCommand(command);
    responses[1]!({ ok: false, error: { code: 'INVALID_COMMAND', message: 'Rejected.' }, action: 'NONE' } as never);
    await Promise.resolve();
    expect(errors).toHaveBeenCalledWith('Rejected.');
    expect(pending).toHaveBeenLastCalledWith(false);
  });

  it('ingests duplicate acknowledgements through the same authoritative path', async () => {
    const pending = vi.fn();
    const errors = vi.fn();
    const gate = new RealtimeCommandGate(() => metadata, {
      submitRealtimeCommand: async () => ({ ok: true, status: 'DUPLICATE', data: {} } as never),
    }, pending, errors);

    expect(gate.submitRealtimeCommand(command).accepted).toBe(true);
    await vi.waitFor(() => expect(pending).toHaveBeenLastCalledWith(false));
    expect(errors).not.toHaveBeenCalled();
  });

  it('rejects submission without current bridge metadata', () => {
    const transport = { submitRealtimeCommand: vi.fn<(envelope: RealtimeCommandEnvelope) => Promise<never>>() };
    const gate = new RealtimeCommandGate(() => null, transport);
    expect(gate.submitRealtimeCommand(command)).toEqual({ accepted: false, message: 'Realtime collaboration is not connected.' });
    expect(transport.submitRealtimeCommand).not.toHaveBeenCalled();
  });

  it('blocks a second command until the first ACK has been authoritatively ingested', async () => {
    let acknowledge: ((value: never) => void) | undefined;
    let finishIngestion: (() => void) | undefined;
    const gate = new RealtimeCommandGate(
      () => metadata,
      { submitRealtimeCommand: () => new Promise<never>((resolve) => { acknowledge = resolve; }) },
      undefined,
      undefined,
      async () => new Promise<void>((resolve) => { finishIngestion = resolve; }),
      () => 'command-1',
    );

    gate.submitRealtimeCommand(command);
    acknowledge!({ ok: true, status: 'APPLIED', data: {} } as never);
    await Promise.resolve();
    expect(gate.submitRealtimeCommand(command)).toMatchObject({ accepted: false });
    finishIngestion!();
    await vi.waitFor(() => expect(gate.submitRealtimeCommand(command)).toMatchObject({ accepted: true }));
  });

  it('keeps one uncertain command blocked through timeout and a delayed ACK until authoritative recovery installs', async () => {
    vi.useFakeTimers();
    try {
      let acknowledge: ((value: never) => void) | undefined;
      let resolveRecovery: ((recovered: boolean) => void) | undefined;
      const submitted = vi.fn(() => new Promise<never>((resolve) => { acknowledge = resolve; }));
      const pending = vi.fn();
      const ingested = vi.fn();
      const recover = vi.fn(() => new Promise<boolean>((resolve) => { resolveRecovery = resolve; }));
      const commandIdFactory = vi.fn(() => 'command-1');
      const gate = new RealtimeCommandGate(
        () => metadata,
        { submitRealtimeCommand: submitted },
        pending,
        undefined,
        ingested,
        commandIdFactory,
        recover,
        100,
      );

      expect(gate.submitRealtimeCommand(command)).toEqual({ accepted: true, commandId: 'command-1' });
      await vi.advanceTimersByTimeAsync(100);
      expect(recover).toHaveBeenCalledTimes(1);
      expect(gate.submitRealtimeCommand(command)).toMatchObject({ accepted: false });
      expect(commandIdFactory).toHaveBeenCalledTimes(1);

      acknowledge!({ ok: true, status: 'APPLIED', data: {} } as never);
      await Promise.resolve();
      expect(ingested).toHaveBeenCalledTimes(1);
      expect(pending).toHaveBeenLastCalledWith(true);

      resolveRecovery!(true);
      await vi.runAllTimersAsync();
      expect(pending).toHaveBeenLastCalledWith(false);
      expect(submitted).toHaveBeenCalledTimes(1);
      expect(commandIdFactory).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancels the acknowledgement timeout when its generation is cleared', async () => {
    vi.useFakeTimers();
    try {
      const recover = vi.fn(async () => true);
      const gate = new RealtimeCommandGate(
        () => metadata,
        { submitRealtimeCommand: () => new Promise<never>(() => undefined) },
        undefined,
        undefined,
        undefined,
        () => 'command-1',
        recover,
        100,
      );

      gate.submitRealtimeCommand(command);
      gate.clear();
      await vi.advanceTimersByTimeAsync(100);
      expect(recover).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
