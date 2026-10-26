import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { redactSensitiveFields } from '../utils/redact.util';
import type { ValidationFieldError } from './validation-exception.factory';

export class ProblemFieldErrorDto implements ValidationFieldError {
  @ApiProperty({ example: 'accept_consent' })
  field!: string;

  @ApiProperty({ example: 'accept_consent must be equal to true' })
  message!: string;
}

export class ProblemDetailsDto {
  @ApiProperty({ example: 'https://asisconexion.org/problems/conflict' })
  type!: string;

  @ApiProperty({ example: 'Conflict' })
  title!: string;

  @ApiProperty({ example: 409 })
  status!: number;

  @ApiProperty({
    example: 'El username o email ya se encuentra registrado en el ecosistema fundacional.',
  })
  detail!: string;

  @ApiProperty({ example: '/v1/auth/registro' })
  instance!: string;

  @ApiProperty({ example: '2026-10-25T18:00:00.000Z' })
  timestamp!: string;

  @ApiPropertyOptional({ type: () => [ProblemFieldErrorDto] })
  errors?: ProblemFieldErrorDto[];
}

interface HttpStatusMeta {
  readonly slug: string;
  readonly title: string;
}

const STATUS_META_MAP: Readonly<Record<number, HttpStatusMeta>> = {
  [HttpStatus.BAD_REQUEST]: { slug: 'bad-request', title: 'Bad Request' },
  [HttpStatus.UNAUTHORIZED]: { slug: 'unauthorized', title: 'Unauthorized' },
  [HttpStatus.FORBIDDEN]: { slug: 'forbidden', title: 'Forbidden' },
  [HttpStatus.NOT_FOUND]: { slug: 'not-found', title: 'Not Found' },
  [HttpStatus.CONFLICT]: { slug: 'conflict', title: 'Conflict' },
  [HttpStatus.UNPROCESSABLE_ENTITY]: {
    slug: 'unprocessable-entity',
    title: 'Unprocessable Entity',
  },
  [HttpStatus.TOO_MANY_REQUESTS]: { slug: 'too-many-requests', title: 'Too Many Requests' },
  [HttpStatus.INTERNAL_SERVER_ERROR]: {
    slug: 'internal-server-error',
    title: 'Internal Server Error',
  },
  [HttpStatus.NOT_IMPLEMENTED]: { slug: 'not-implemented', title: 'Not Implemented' },
  [HttpStatus.BAD_GATEWAY]: { slug: 'bad-gateway', title: 'Bad Gateway' },
  [HttpStatus.SERVICE_UNAVAILABLE]: { slug: 'service-unavailable', title: 'Service Unavailable' },
};

function isPgDriverErrorWithCode(error: unknown): error is { readonly code?: string } {
  return typeof error === 'object' && error !== null && 'code' in error;
}

function isValidationFieldErrorArray(value: unknown): value is ValidationFieldError[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        'field' in item &&
        'message' in item &&
        typeof (item as Record<string, unknown>)['field'] === 'string' &&
        typeof (item as Record<string, unknown>)['message'] === 'string',
    )
  );
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    if (response.headersSent) {
      return;
    }
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let detail = 'Ocurrió un error interno inesperado al procesar la solicitud.';
    let errors: ValidationFieldError[] | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const rawResponse = exception.getResponse();

      if (typeof rawResponse === 'string') {
        detail = rawResponse;
      } else if (typeof rawResponse === 'object' && rawResponse !== null) {
        const body = rawResponse as Record<string, unknown>;
        const messageField = body['message'];
        if (typeof messageField === 'string') {
          detail = messageField;
        } else if (Array.isArray(messageField)) {
          detail = messageField
            .filter((entry): entry is string => typeof entry === 'string')
            .join('; ');
        }
        if (isValidationFieldErrorArray(body['errors'])) {
          errors = body['errors'];
        }
      }
    } else if (
      exception instanceof QueryFailedError &&
      isPgDriverErrorWithCode(exception.driverError) &&
      exception.driverError.code === '23505'
    ) {
      status = HttpStatus.CONFLICT;
      detail = 'El recurso solicitado ya existe o infringe una restricción de unicidad.';
    } else {
      const safeBody = redactSensitiveFields(request.body);
      const errorMessage = exception instanceof Error ? exception.message : 'Excepción desconocida';
      this.logger.error(
        `Error no controlado en ${request.method} ${request.originalUrl}: ${errorMessage}`,
        JSON.stringify({ body: safeBody }),
      );
    }

    const meta = STATUS_META_MAP[status] ?? {
      slug: `http-${status}`,
      title: 'HTTP Error',
    };

    const problem: ProblemDetailsDto = {
      type: `https://asisconexion.org/problems/${meta.slug}`,
      title: meta.title,
      status,
      detail,
      instance: request.originalUrl || request.url,
      timestamp: new Date().toISOString(),
      ...(errors && errors.length > 0 ? { errors } : {}),
    };

    response.status(status).type('application/problem+json').json(problem);
  }
}
