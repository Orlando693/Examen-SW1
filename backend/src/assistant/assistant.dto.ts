import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import type { AssistantCommand, AssistantDiagnostic, AssistantPreview, NeedsClarificationCommand } from '@examen-sw1/assistant-core';

export class InterpretAssistantDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2_000)
  text!: string;
}

export type AssistantInterpretationStatus = 'success' | 'model_unavailable' | 'cancelled' | 'timeout' | 'invalid';

export interface AssistantInterpretationDto {
  status: AssistantInterpretationStatus;
  candidate?: AssistantCommand;
  clarification?: NeedsClarificationCommand;
  preview?: AssistantPreview;
  diagnostics: AssistantDiagnostic[];
}
