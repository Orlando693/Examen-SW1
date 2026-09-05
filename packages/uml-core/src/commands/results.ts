import type { ProjectDocument } from '../model/document.js';
import type { ValidationDiagnostic } from '../validation/diagnostics.js';
import type { UmlCommand } from './commands.js';

export type CommandFailureReason = 'UNSUPPORTED_COMMAND' | 'NOT_FOUND' | 'VALIDATION_FAILED' | 'INVALID_COMMAND';

export type CommandResult = CommandAcceptedResult | CommandRejectedResult;

export interface CommandAcceptedResult {
  ok: true;
  command: UmlCommand;
  document: ProjectDocument;
  diagnostics: ValidationDiagnostic[];
}

export interface CommandRejectedResult {
  ok: false;
  command: UmlCommand;
  document: ProjectDocument;
  reason: CommandFailureReason;
  message: string;
  diagnostics: ValidationDiagnostic[];
}
