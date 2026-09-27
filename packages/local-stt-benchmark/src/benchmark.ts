import { createPreview } from '@examen-sw1/assistant-core';
import type { SttBenchmarkCase } from './benchmark-dataset.js';

const punctuation = /[\p{P}\p{S}]+/gu;
export function normalizeSttTranscript(value: string): string { return value.toLocaleLowerCase('es').replace(punctuation, (match) => match === '_' ? '_' : ' ').trim().replace(/\s+/g, ' '); }
export interface WerResult { reference: string; transcript: string; normalizedReference: string; normalizedTranscript: string; referenceTokens: string[]; transcriptTokens: string[]; substitutions: number; insertions: number; deletions: number; errors: number; denominator: number; wer: number; }
export function calculateWer(reference: string, transcript: string): WerResult {
  const normalizedReference = normalizeSttTranscript(reference); const normalizedTranscript = normalizeSttTranscript(transcript);
  const referenceTokens = normalizedReference ? normalizedReference.split(' ') : []; const transcriptTokens = normalizedTranscript ? normalizedTranscript.split(' ') : [];
  const matrix = Array.from({ length: referenceTokens.length + 1 }, () => Array.from({ length: transcriptTokens.length + 1 }, () => ({ cost: 0, substitutions: 0, insertions: 0, deletions: 0 })));
  for (let row = 1; row <= referenceTokens.length; row += 1) matrix[row][0] = { cost: row, substitutions: 0, insertions: 0, deletions: row };
  for (let column = 1; column <= transcriptTokens.length; column += 1) matrix[0][column] = { cost: column, substitutions: 0, insertions: column, deletions: 0 };
  for (let row = 1; row <= referenceTokens.length; row += 1) for (let column = 1; column <= transcriptTokens.length; column += 1) {
    const prior = matrix[row - 1][column - 1]; const alternatives = referenceTokens[row - 1] === transcriptTokens[column - 1]
      ? [prior] : [{ ...prior, cost: prior.cost + 1, substitutions: prior.substitutions + 1 }, (() => { const left = matrix[row][column - 1]; return { ...left, cost: left.cost + 1, insertions: left.insertions + 1 }; })(), (() => { const up = matrix[row - 1][column]; return { ...up, cost: up.cost + 1, deletions: up.deletions + 1 }; })()];
    matrix[row][column] = alternatives.reduce((best, item) => item.cost < best.cost ? item : best);
  }
  const result = matrix[referenceTokens.length][transcriptTokens.length]; const denominator = referenceTokens.length;
  return { reference, transcript, normalizedReference, normalizedTranscript, referenceTokens, transcriptTokens, substitutions: result.substitutions, insertions: result.insertions, deletions: result.deletions, errors: result.cost, denominator, wer: denominator === 0 ? (transcriptTokens.length === 0 ? 0 : 1) : result.cost / denominator };
}

export interface CommandPreviewResult { caseId: string; expectedOutcome: SttBenchmarkCase['expected']['outcome']; actualOutcome: 'preview' | 'clarification' | 'rejected'; diagnosticCodes: string[]; successful: boolean; documentUnchanged: true; }
/** This uses only deterministic expected candidates and createPreview; it has no provider or apply route. */
export function runCommandPreview(caseDescriptor: SttBenchmarkCase, reviewedTranscript = caseDescriptor.expectedNormalizedTranscript): CommandPreviewResult {
  const before = structuredClone(caseDescriptor.context);
  if (normalizeSttTranscript(reviewedTranscript) !== caseDescriptor.expectedNormalizedTranscript) return { caseId: caseDescriptor.id, expectedOutcome: caseDescriptor.expected.outcome, actualOutcome: 'rejected', diagnosticCodes: ['TRANSCRIPT_MISMATCH'], successful: false, documentUnchanged: true };
  if (!caseDescriptor.expected.candidate) return { caseId: caseDescriptor.id, expectedOutcome: caseDescriptor.expected.outcome, actualOutcome: 'rejected', diagnosticCodes: [caseDescriptor.expected.diagnosticCode ?? 'TRANSCRIPTION_FAILED'], successful: caseDescriptor.expected.diagnosticCode !== undefined, documentUnchanged: true };
  const preview = createPreview(caseDescriptor.expectedNormalizedTranscript, caseDescriptor.expected.candidate, caseDescriptor.context);
  if (JSON.stringify(before) !== JSON.stringify(caseDescriptor.context)) throw new Error(`Preview mutated benchmark context: ${caseDescriptor.id}`);
  const actualOutcome = preview.ok ? 'preview' : preview.clarification ? 'clarification' : 'rejected'; const diagnosticCodes = preview.ok ? [] : preview.diagnostics.map((item) => item.code);
  const successful = actualOutcome === caseDescriptor.expected.outcome && (caseDescriptor.expected.diagnosticCode === undefined || diagnosticCodes.includes(caseDescriptor.expected.diagnosticCode)) && (caseDescriptor.expected.destructive === undefined || (preview.ok && preview.preview.requiresConfirmation === caseDescriptor.expected.destructive));
  return { caseId: caseDescriptor.id, expectedOutcome: caseDescriptor.expected.outcome, actualOutcome, diagnosticCodes, successful, documentUnchanged: true };
}

export function aggregateCommandSuccess(results: ReadonlyArray<CommandPreviewResult>): { denominator: number; passed: number; rate: number } { const passed = results.filter((item) => item.successful).length; return { denominator: results.length, passed, rate: results.length === 0 ? 0 : passed / results.length }; }
