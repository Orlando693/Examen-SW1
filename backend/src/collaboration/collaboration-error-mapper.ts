import { ProjectApiError, StoredProjectDataError } from '../projects/project.errors.js';
import type { CollaborationAction, CollaborationError, CollaborationErrorCode } from './contracts.js';
import { CollaborationCapacityError } from './collaboration-session.manager.js';

type ErrorDefinition = { action: CollaborationAction; message: string };

export const COLLABORATION_ERROR_MATRIX = {
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
} as const satisfies Record<CollaborationErrorCode, ErrorDefinition>;

export function collaborationFailure(code: CollaborationErrorCode): CollaborationError {
  const definition = COLLABORATION_ERROR_MATRIX[code];
  return { ok: false, error: { code, message: definition.message }, action: definition.action };
}

export function mapCollaborationException(exception: unknown, expiresAt?: number): CollaborationError {
  if (exception instanceof CollaborationCapacityError) return collaborationFailure('RATE_LIMITED');
  if (exception instanceof StoredProjectDataError) {
    return collaborationFailure(exception.unsupportedFormat ? 'SCHEMA_INCOMPATIBLE' : 'INTERNAL_ERROR');
  }

  if (exception instanceof ProjectApiError) {
    if (exception.code === 'AUTHENTICATION_REQUIRED') {
      return collaborationFailure(expiresAt !== undefined && Date.now() >= expiresAt ? 'AUTH_EXPIRED' : 'AUTHENTICATION_REQUIRED');
    }
    if (exception.code === 'PROJECT_NOT_FOUND' || exception.code === 'FORBIDDEN') {
      return collaborationFailure('PROJECT_NOT_FOUND');
    }
  }

  return collaborationFailure('INTERNAL_ERROR');
}
