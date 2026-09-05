import type { ProjectDocument } from '../model/document.js';
import { cloneProjectDocument } from '../model/document.js';
import { UmlCommandBus } from '../commands/command-bus.js';
import type { UmlCommand } from '../commands/commands.js';
import type { CommandResult } from '../commands/results.js';

export const DEFAULT_HISTORY_LIMIT = 100;

interface HistoryEntry {
  command: UmlCommand;
  before: ProjectDocument;
  after: ProjectDocument;
}

export interface UmlHistoryOptions {
  historyLimit?: number;
  commandBus?: UmlCommandBus;
}

export interface HistoryMoveResult {
  ok: boolean;
  document: ProjectDocument;
}

export class UmlHistory {
  private readonly historyLimit: number;
  private readonly commandBus: UmlCommandBus;
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private currentDocument: ProjectDocument;

  constructor(document: ProjectDocument, options: UmlHistoryOptions = {}) {
    this.currentDocument = cloneProjectDocument(document);
    this.historyLimit = options.historyLimit ?? DEFAULT_HISTORY_LIMIT;
    this.commandBus = options.commandBus ?? new UmlCommandBus();
  }

  get document(): ProjectDocument {
    return cloneProjectDocument(this.currentDocument);
  }

  get undoCount(): number {
    return this.undoStack.length;
  }

  get redoCount(): number {
    return this.redoStack.length;
  }

  execute(command: UmlCommand): CommandResult {
    const before = cloneProjectDocument(this.currentDocument);
    const result = this.commandBus.execute(this.currentDocument, command);
    if (!result.ok) {
      return result;
    }

    this.currentDocument = cloneProjectDocument(result.document);
    this.undoStack.push({ command, before, after: cloneProjectDocument(result.document) });
    if (this.undoStack.length > this.historyLimit) {
      this.undoStack = this.undoStack.slice(this.undoStack.length - this.historyLimit);
    }
    this.redoStack = [];
    return result;
  }

  undo(): HistoryMoveResult {
    const entry = this.undoStack.pop();
    if (!entry) {
      return { ok: false, document: this.document };
    }
    this.currentDocument = cloneProjectDocument(entry.before);
    this.redoStack.push(entry);
    return { ok: true, document: this.document };
  }

  redo(): HistoryMoveResult {
    const entry = this.redoStack.pop();
    if (!entry) {
      return { ok: false, document: this.document };
    }
    this.currentDocument = cloneProjectDocument(entry.after);
    this.undoStack.push(entry);
    return { ok: true, document: this.document };
  }
}
