export interface CollaborationLimits {
  payloadBytes: number;
  commandRatePerSecond: number;
  commandBurstCapacity: number;
  presenceRatePerSecond: number;
  presenceBurstCapacity: number;
  commandStringLength: number;
  presenceIdentifierLength: number;
  presenceSelectionCapacity: number;
  layoutUpdateCapacity: number;
  joinBufferCapacity: number;
  sessionCapacity: number;
  dedupeCapacity: number;
  dedupeTtlMs: number;
  reconnectTtlMs: number;
  rateBucketCapacity: number;
  allowedOrigins: readonly string[];
}

const defaults = {
  payloadBytes: 1_048_576,
  commandRatePerSecond: 10,
  commandBurstCapacity: 10,
  presenceRatePerSecond: 30,
  presenceBurstCapacity: 5,
  commandStringLength: 256,
  presenceIdentifierLength: 64,
  presenceSelectionCapacity: 50,
  layoutUpdateCapacity: 1_000,
  joinBufferCapacity: 128,
  sessionCapacity: 512,
  dedupeCapacity: 512,
  dedupeTtlMs: 600_000,
  reconnectTtlMs: 5_000,
  rateBucketCapacity: 4_096,
} as const;

function positiveInteger(environment: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const value = environment[name];
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error(`${name} must be a positive safe integer.`);
  return parsed;
}

export function readCollaborationLimits(environment = process.env): CollaborationLimits {
  const origins = (environment.FRONTEND_ORIGIN ?? 'http://localhost:3000').split(',').map((origin) => origin.trim());
  if (!origins.length || origins.some((origin) => !/^https?:\/\/[^/]+$/i.test(origin))) {
    throw new Error('FRONTEND_ORIGIN must contain explicit HTTP(S) origins without paths.');
  }
  return {
    payloadBytes: positiveInteger(environment, 'COLLABORATION_PAYLOAD_BYTES', defaults.payloadBytes),
    commandRatePerSecond: positiveInteger(environment, 'COLLABORATION_COMMAND_RATE_PER_SECOND', defaults.commandRatePerSecond),
    commandBurstCapacity: positiveInteger(environment, 'COLLABORATION_COMMAND_BURST_CAPACITY', defaults.commandBurstCapacity),
    presenceRatePerSecond: positiveInteger(environment, 'COLLABORATION_PRESENCE_RATE_PER_SECOND', defaults.presenceRatePerSecond),
    presenceBurstCapacity: positiveInteger(environment, 'COLLABORATION_PRESENCE_BURST_CAPACITY', defaults.presenceBurstCapacity),
    commandStringLength: positiveInteger(environment, 'COLLABORATION_COMMAND_STRING_LENGTH', defaults.commandStringLength),
    presenceIdentifierLength: positiveInteger(environment, 'COLLABORATION_PRESENCE_IDENTIFIER_LENGTH', defaults.presenceIdentifierLength),
    presenceSelectionCapacity: positiveInteger(environment, 'COLLABORATION_PRESENCE_SELECTION_CAPACITY', defaults.presenceSelectionCapacity),
    layoutUpdateCapacity: positiveInteger(environment, 'COLLABORATION_LAYOUT_UPDATE_CAPACITY', defaults.layoutUpdateCapacity),
    joinBufferCapacity: positiveInteger(environment, 'COLLABORATION_JOIN_BUFFER_CAPACITY', defaults.joinBufferCapacity),
    sessionCapacity: positiveInteger(environment, 'COLLABORATION_SESSION_CAPACITY', defaults.sessionCapacity),
    dedupeCapacity: positiveInteger(environment, 'COLLABORATION_DEDUPE_CAPACITY', defaults.dedupeCapacity),
    dedupeTtlMs: positiveInteger(environment, 'COLLABORATION_DEDUPE_TTL_MS', defaults.dedupeTtlMs),
    reconnectTtlMs: positiveInteger(environment, 'COLLABORATION_RECONNECT_TTL_MS', defaults.reconnectTtlMs),
    rateBucketCapacity: positiveInteger(environment, 'COLLABORATION_RATE_BUCKET_CAPACITY', defaults.rateBucketCapacity),
    allowedOrigins: origins,
  };
}

export const COLLABORATION_LIMITS = readCollaborationLimits();
