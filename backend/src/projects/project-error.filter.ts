import { ArgumentsHost, Catch, HttpException, Logger } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { StructuralDecodeError } from '@examen-sw1/uml-core';
import { ProjectApiError, StoredProjectDataError } from './project.errors.js';

@Catch()
export class ProjectErrorFilter {
  private readonly logger = new Logger(ProjectErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<FastifyReply>();
    const error = this.toApiError(exception);
    response.status(error.statusCode).send({ error: { code: error.code, message: error.message, details: error.details } });
  }

  private toApiError(exception: unknown): ProjectApiError {
    if (exception instanceof ProjectApiError) return exception;
    if (exception instanceof StoredProjectDataError) {
      if (exception.unsupportedFormat) {
        return new ProjectApiError(422, 'UNSUPPORTED_DOCUMENT_SCHEMA_VERSION', 'The project uses an unsupported document schema version.');
      }
      this.logger.error('Stored project data could not be decoded.');
      return new ProjectApiError(500, 'INTERNAL_ERROR', 'An internal error occurred.');
    }
    if (exception instanceof StructuralDecodeError) {
      return new ProjectApiError(400, 'INVALID_REQUEST', 'The document payload is malformed.', { diagnostics: exception.diagnostics });
    }
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      if (statusCode === 413) return new ProjectApiError(413, 'PAYLOAD_TOO_LARGE', 'The request payload is too large.');
      const payload = exception.getResponse();
      const details = typeof payload === 'object' && payload !== null ? payload : {};
      return new ProjectApiError(400, 'INVALID_REQUEST', 'The request is invalid.', { validation: details });
    }
    if (typeof exception === 'object' && exception !== null && 'statusCode' in exception && exception.statusCode === 413) {
      return new ProjectApiError(413, 'PAYLOAD_TOO_LARGE', 'The request payload is too large.');
    }
    this.logger.error('Unexpected project API error.');
    return new ProjectApiError(500, 'INTERNAL_ERROR', 'An internal error occurred.');
  }
}
