import { describe, expect, it } from 'vitest';
import { DeterministicAssistantProvider } from './deterministic-assistant.provider.js';
import { createAssistantInterpreter } from './assistant.provider.js';

describe('createAssistantInterpreter', () => {
  it('rejects the deterministic provider outside the test environment', () => {
    expect(() => createAssistantInterpreter({ ASSISTANT_PROVIDER: 'deterministic', NODE_ENV: 'production' })).toThrow('allowed only when NODE_ENV=test');
  });

  it('only enables the deterministic provider through explicit test opt-in', () => {
    expect(createAssistantInterpreter({ ASSISTANT_PROVIDER: 'deterministic', NODE_ENV: 'test' })).toBeInstanceOf(DeterministicAssistantProvider);
  });
});
