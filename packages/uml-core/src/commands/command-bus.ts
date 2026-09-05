import type { ProjectDocument } from '../model/document.js';
import { executeCommand, type ExecuteCommandOptions } from './executors.js';
import type { UmlCommand } from './commands.js';
import type { CommandResult } from './results.js';

export class UmlCommandBus {
  execute(document: ProjectDocument, command: UmlCommand, options: ExecuteCommandOptions = {}): CommandResult {
    return executeCommand(document, command, options);
  }
}
