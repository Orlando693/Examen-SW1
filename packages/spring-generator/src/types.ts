export interface SpringGeneratorDiagnostic {
  severity: 'ERROR' | 'WARNING';
  code: string;
  message: string;
  path: string;
}

export interface SpringGeneratorOptions {
  basePackage?: string;
  outputRoot?: string;
}

export interface GeneratedFile {
  path: string;
  content: string | Uint8Array;
  sha256: string;
}

export interface GeneratedManifest {
  algorithm: 'sha256';
  files: Array<{ path: string; sha256: string }>;
}

export interface SpringGenerationResult {
  basePackage: string;
  files: GeneratedFile[];
  manifest: GeneratedManifest;
}

export interface SpringGenerationResponse {
  diagnostics: SpringGeneratorDiagnostic[];
  result?: SpringGenerationResult;
  files: GeneratedFile[];
}
