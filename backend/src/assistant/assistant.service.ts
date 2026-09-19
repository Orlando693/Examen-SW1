import { Inject, Injectable } from '@nestjs/common';
import { createAssistantModelContext, createPreview, type AssistantDiagnostic } from '@examen-sw1/assistant-core';
import type { LocalLlmResult } from '@examen-sw1/local-llm';
import type { SafeUser } from '../auth/users.repository.js';
import { ProjectsService } from '../projects/projects.service.js';
import type { AssistantInterpretationDto, InterpretAssistantDto } from './assistant.dto.js';

export interface LocalAssistantInterpreter {
  interpret(input: { text: string; context: ReturnType<typeof createAssistantModelContext>; signal?: AbortSignal; onPresentationChunk?: (chunk: string) => void }): Promise<LocalLlmResult>;
}

export const LOCAL_ASSISTANT_INTERPRETER = Symbol('LOCAL_ASSISTANT_INTERPRETER');

const diagnostic = (code: string, message: string): AssistantDiagnostic => ({ code, message, path: '$' });

@Injectable()
export class AssistantService {
  constructor(
    @Inject(ProjectsService) private readonly projects: ProjectsService,
    @Inject(LOCAL_ASSISTANT_INTERPRETER) private readonly interpreter: LocalAssistantInterpreter,
  ) {}

  async ensureAuthorized(user: SafeUser, projectId: string): Promise<void> {
    await this.projects.get(user, projectId);
  }

  async interpret(user: SafeUser, projectId: string, input: InterpretAssistantDto, signal?: AbortSignal, onPresentationChunk?: (chunk: string) => void): Promise<AssistantInterpretationDto> {
    // This access-checked snapshot is intentionally the sole UML input to the provider.
    const resource = await this.projects.get(user, projectId);
    const context = createAssistantModelContext(resource.project);
    const result = await this.interpreter.interpret({ text: input.text, context, ...(signal === undefined ? {} : { signal }), ...(onPresentationChunk === undefined ? {} : { onPresentationChunk }) });
    if (!result.ok) return this.failure(result.diagnostics);

    const preview = createPreview(input.text, result.candidate, context);
    if (!preview.ok) {
      return {
        status: 'success',
        candidate: result.candidate,
        ...(preview.clarification === undefined ? {} : { clarification: preview.clarification }),
        diagnostics: preview.diagnostics,
      };
    }
    return { status: 'success', candidate: result.candidate, preview: preview.preview, diagnostics: [] };
  }

  private failure(diagnostics: AssistantDiagnostic[]): AssistantInterpretationDto {
    const codes = new Set(diagnostics.map((item) => item.code));
    const status = codes.has('MODEL_UNAVAILABLE') || codes.has('MODEL_LOAD_FAILED') || codes.has('INVALID_MODEL_PATH')
      ? 'model_unavailable'
      : codes.has('GENERATION_CANCELLED') ? 'cancelled'
        : codes.has('GENERATION_TIMEOUT') ? 'timeout'
          : 'invalid';
    return { status, diagnostics: diagnostics.length > 0 ? diagnostics : [diagnostic('INVALID_PROVIDER_OUTPUT', 'The local assistant did not return a valid interpretation.')] };
  }
}
