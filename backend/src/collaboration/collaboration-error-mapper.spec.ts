import { describe, expect, it } from 'vitest';
import { ProjectApiError, StoredProjectDataError } from '../projects/project.errors.js';
import { COLLABORATION_ERROR_MATRIX, collaborationFailure, mapCollaborationException } from './collaboration-error-mapper.js';
import { CollaborationCapacityError } from './collaboration-session.manager.js';

describe('collaboration error mapper', () => {
  it('uses one closed code, action, and safe-message matrix', () => {
    expect(COLLABORATION_ERROR_MATRIX).toEqual({
      AUTHENTICATION_REQUIRED: { action: 'REAUTHENTICATE', message: 'Authentication is required.' },
      AUTH_EXPIRED: { action: 'REAUTHENTICATE', message: 'Authentication has expired.' },
      PROJECT_NOT_FOUND: { action: 'LEAVE', message: 'The project was not found.' },
      PROJECT_NOT_JOINED: { action: 'RESYNC', message: 'Project collaboration is not active.' },
      INVALID_COMMAND: { action: 'NONE', message: 'The request is invalid.' },
      PAYLOAD_TOO_LARGE: { action: 'NONE', message: 'The request payload is too large.' },
      RATE_LIMITED: { action: 'NONE', message: 'The request rate limit was exceeded.' },
      STALE_SESSION: { action: 'RESYNC', message: 'Shared project state changed.' },
      STALE_REALTIME_VERSION: { action: 'RESYNC', message: 'Shared project state changed.' },
      STALE_DOCUMENT_REVISION: { action: 'RESYNC', message: 'Shared project state changed.' },
      DOMAIN_COMMAND_REJECTED: { action: 'NONE', message: 'The command was rejected.' },
      SEMANTIC_VALIDATION_FAILED: { action: 'NONE', message: 'The command was rejected.' },
      CAS_CONFLICT: { action: 'RESYNC', message: 'Shared project state changed.' },
      SCHEMA_INCOMPATIBLE: { action: 'RESYNC', message: 'The project document is incompatible.' },
      INTERNAL_STATE_UNCERTAIN: { action: 'RESYNC', message: 'Project state must be resynchronized.' },
      INTERNAL_ERROR: { action: 'RESYNC', message: 'An internal error occurred.' },
    });
  });

  it('maps schema, authentication, concealment, and unexpected failures without exposing their cause', () => {
    const secret = 'Prisma SELECT jwt.token=secret-token storageVersion=41 at stack.ts:99';
    const cases = [
      [new StoredProjectDataError(true), undefined, 'SCHEMA_INCOMPATIBLE'],
      [new StoredProjectDataError(false), undefined, 'INTERNAL_ERROR'],
      [new ProjectApiError(403, 'FORBIDDEN', secret), undefined, 'PROJECT_NOT_FOUND'],
      [new ProjectApiError(401, 'AUTHENTICATION_REQUIRED', secret), Date.now() - 1, 'AUTH_EXPIRED'],
      [new CollaborationCapacityError(), undefined, 'RATE_LIMITED'],
      [new Error(secret), undefined, 'INTERNAL_ERROR'],
    ] as const;

    for (const [exception, expiresAt, code] of cases) {
      const response = mapCollaborationException(exception, expiresAt);
      expect(response).toEqual(collaborationFailure(code));
      expect(response.error).not.toHaveProperty('details');
      for (const forbidden of ['Prisma', 'SELECT', 'jwt', 'token', '41', 'stack.ts']) {
        expect(JSON.stringify(response)).not.toContain(forbidden);
      }
    }
  });
});
