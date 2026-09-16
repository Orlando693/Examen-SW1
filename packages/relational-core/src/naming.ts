const RESERVED = new Set(['all', 'and', 'as', 'by', 'case', 'check', 'constraint', 'create', 'delete', 'from', 'group', 'index', 'insert', 'join', 'key', 'limit', 'not', 'null', 'on', 'or', 'order', 'primary', 'select', 'table', 'unique', 'update', 'user', 'where']);

function stableHash(value: string): string {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function sqlName(value: string, sourceId: string, used: Set<string>): string | undefined {
  const normalized = value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/_+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();
  if (!normalized) return undefined;
  const base = RESERVED.has(normalized) ? `${normalized}_` : normalized;
  const candidate = base.slice(0, 63);
  if (!used.has(candidate)) { used.add(candidate); return candidate; }
  const suffix = `_${stableHash(sourceId)}`;
  const resolved = `${base.slice(0, 63 - suffix.length)}${suffix}`;
  if (used.has(resolved)) return undefined;
  used.add(resolved);
  return resolved;
}

export function derivedName(prefix: string, values: string[], sourceId: string, used: Set<string>): string | undefined {
  return sqlName([prefix, ...values].join('_'), sourceId, used);
}
