import { LocalLlmAssistantProvider, NodeLlamaRuntime } from '@examen-sw1/local-llm';
import { DeterministicAssistantProvider } from './deterministic-assistant.provider.js';
import type { LocalAssistantInterpreter } from './assistant.service.js';

export function createAssistantInterpreter(environment = process.env): LocalAssistantInterpreter {
  if (environment.ASSISTANT_PROVIDER === 'deterministic') {
    if (environment.NODE_ENV !== 'test') {
      throw new Error('ASSISTANT_PROVIDER=deterministic is allowed only when NODE_ENV=test.');
    }
    return new DeterministicAssistantProvider();
  }
  if (environment.ASSISTANT_PROVIDER !== undefined && environment.ASSISTANT_PROVIDER !== '' && environment.ASSISTANT_PROVIDER !== 'local') {
    throw new Error('ASSISTANT_PROVIDER must be local or deterministic.');
  }
  return new LocalLlmAssistantProvider({ runtime: new NodeLlamaRuntime() });
}
