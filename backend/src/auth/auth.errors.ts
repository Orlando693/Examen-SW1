import { ProjectApiError } from '../projects/project.errors.js';

export class AuthenticationRequiredError extends ProjectApiError {
  constructor() {
    super(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  }
}

export class InvalidCredentialsError extends ProjectApiError {
  constructor() {
    super(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }
}

export class DuplicateEmailError extends ProjectApiError {
  constructor() {
    super(409, 'EMAIL_ALREADY_REGISTERED', 'An account already exists for this email address.');
  }
}
