export type Uuid = string;

export function createUuid(explicitId?: Uuid): Uuid {
  return explicitId ?? globalThis.crypto.randomUUID();
}
