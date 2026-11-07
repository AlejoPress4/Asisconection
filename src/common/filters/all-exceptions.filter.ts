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

/**
 * Formato estándar RFC 7807 (`application/problem+json`) para respuestas de error HTTP.
 */
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

const STATUS_META: Readonly<Record<number, { slug: string; title: string }>> = {
  [HttpStatus.BAD_REQUEST]: { slug: 'bad-request', title: 'Bad Request' },
  [HttpStatus.UNAUTHORIZED]: { slug: 'unauthorized', title: 'Unauthorized' },
  [HttpStatus.FORBIDDEN]: { slug: 'forbidden', title: 'Forbidden' },
  [HttpStatus.NOT_FOUND]: { slug: 'not-found', title: 'Not Found' },
  [HttpStatus.CONFLICT]: { slug: 'conflict', title: 'Conflict' },
  [HttpStatus.UNPROCESSABLE_ENTITY]: { slug: 'unprocessable-entity', title: 'Unprocessable Entity' },
  [HttpStatus.TOO_MANY_REQUESTS]: { slug: 'too-many-requests', title: 'Too Many Requests' },
  [HttpStatus.INTERNAL_SERVER_ERROR]: { slug: 'internal-server-error', title: 'Internal Server Error' },
  [HttpStatus.NOT_IMPLEMENTED]: { slug: 'not-implemented', title: 'Not Implemented' },
  [HttpStatus.BAD_GATEWAY]: { slug: 'bad-gateway', title: 'Bad Gateway' },
  [HttpStatus.SERVICE_UNAVAILABLE]: { slug: 'service-unavailable', title: 'Service Unavailable' },
};

/**
 * Filtro global que transforma cualquier excepción en una respuesta RFC 7807 (`application/problem+json`)
 * y redacta campos sensibles (`clave`, tokens) antes de escribir logs de error.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    if (response.headersSent) return;

    const request = ctx.getRequest<Request>();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let detail = 'Ocurrió un error interno inesperado al procesar la solicitud.';
    let errors: ValidationFieldError[] | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const raw = exception.getResponse();
      if (typeof raw === 'string') {
        detail = raw;
      } else if (typeof raw === 'object' && raw !== null) {
        const body = raw as Record<string, unknown>;
        if (typeof body['message'] === 'string') {
          detail = body['message'];
        } else if (Array.isArray(body['message'])) {
          detail = body['message'].filter((m): m is string => typeof m === 'string').join('; ');
        }
        if (Array.isArray(body['errors'])) {
          errors = body['errors'] as ValidationFieldError[];
        }
      }
    } else if (
      exception instanceof QueryFailedError &&
      (exception.driverError as { code?: string } | undefined)?.code === '23505'
    ) {
      status = HttpStatus.CONFLICT;
      detail = 'El recurso solicitado ya existe o infringe una restricción de unicidad.';
    } else {
      const msg = exception instanceof Error ? exception.message : 'Excepción desconocida';
      this.logger.error(
        `Error no controlado en ${request.method} ${request.originalUrl}: ${msg}`,
        JSON.stringify({ body: redactSensitiveFields(request.body) }),
      );
    }

    const meta = STATUS_META[status] ?? { slug: `http-${status}`, title: 'HTTP Error' };
    response
      .status(status)
      .type('application/problem+json')
      .json({
        type: `https://asisconexion.org/problems/${meta.slug}`,
        title: meta.title,
        status,
        detail,
        instance: request.originalUrl || request.url,
        timestamp: new Date().toISOString(),
        ...(errors?.length ? { errors } : {}),
      });
  }
}
