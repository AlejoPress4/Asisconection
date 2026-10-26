import { HttpService } from '@nestjs/axios';
import {
  BadGatewayException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isAxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { redactSensitiveFields } from '../../../common/utils/redact.util';
import type { EnvironmentVariables } from '../../../config/env.validation';
import type {
  ExternalAuthUserResult,
  ExternalRegisterPayload,
  IExternalAuthAdapter,
} from '../interfaces/i-render-auth.adapter';

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readOptionalString(record: Record<string, unknown>, key: string): string | null {
  const raw = record[key];
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw.trim();
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return String(raw);
  }
  return null;
}

function parseExternalUserResponse(
  data: unknown,
  fallback: { username?: string; email?: string; rol?: string },
): ExternalAuthUserResult {
  const root = asRecord(data);
  const nestedUser = root ? asRecord(root['user']) ?? asRecord(root['data']) : null;
  const source = nestedUser ?? root ?? {};

  const externalUserId =
    readOptionalString(source, 'id') ??
    readOptionalString(source, 'userId') ??
    (root ? readOptionalString(root, 'id') : null);

  const username =
    readOptionalString(source, 'username') ?? fallback.username ?? '';
  const email =
    readOptionalString(source, 'email') ?? fallback.email ?? '';
  const rawRol =
    readOptionalString(source, 'rol') ??
    readOptionalString(source, 'role') ??
    fallback.rol ??
    'ACUDIENTE';
  const rol = rawRol.trim().toUpperCase();

  if (!username || !email) {
    throw new BadGatewayException(
      'La respuesta recibida desde el servicio externo de autenticación es incompleta.',
    );
  }

  return {
    externalUserId,
    username,
    email,
    rol,
  };
}

@Injectable()
export class ExternalAuthHttpAdapter implements IExternalAuthAdapter {
  private readonly logger = new Logger(ExternalAuthHttpAdapter.name);
  private readonly registerPath: string;
  private readonly loginPath: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {
    this.registerPath = this.configService.get('RENDER_REGISTER_PATH', { infer: true });
    this.loginPath = this.configService.get('RENDER_LOGIN_PATH', { infer: true });
  }

  async registerUser(payload: ExternalRegisterPayload): Promise<ExternalAuthUserResult> {
    const strictPayload: ExternalRegisterPayload = {
      username: payload.username,
      email: payload.email,
      clave: payload.clave,
      rol: payload.rol,
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post<unknown>(this.registerPath, strictPayload),
      );
      return parseExternalUserResponse(response.data, {
        username: payload.username,
        email: payload.email,
        rol: payload.rol,
      });
    } catch (error: unknown) {
      if (error instanceof BadGatewayException || error instanceof ConflictException) {
        throw error;
      }

      if (isAxiosError(error)) {
        const status = error.response?.status;
        this.logger.warn(
          `Fallo en registro hacia Render (status=${status ?? 'network'}): ${JSON.stringify(
            redactSensitiveFields({ username: payload.username, email: payload.email }),
          )}`,
        );

        if (status !== undefined && status >= 400 && status < 500 && status !== 404) {
          throw new ConflictException(
            'El username o email ya se encuentra registrado o fue rechazado por el ecosistema fundacional.',
          );
        }
      }

      throw new BadGatewayException(
        'El servicio central de autenticación no se encuentra disponible temporalmente.',
      );
    }
  }

  async authenticateUser(identifier: string, clave: string): Promise<ExternalAuthUserResult> {
    const trimmed = identifier.trim();
    const loginPayload = trimmed.includes('@')
      ? { email: trimmed, clave }
      : { username: trimmed, clave };

    try {
      const response = await firstValueFrom(
        this.httpService.post<unknown>(this.loginPath, loginPayload),
      );
      return parseExternalUserResponse(response.data, {
        username: trimmed.includes('@') ? undefined : trimmed,
        email: trimmed.includes('@') ? trimmed : undefined,
      });
    } catch (error: unknown) {
      if (error instanceof BadGatewayException || error instanceof UnauthorizedException) {
        throw error;
      }

      if (isAxiosError(error)) {
        const status = error.response?.status;
        this.logger.warn(
          `Fallo en autenticación hacia Render (status=${status ?? 'network'}): ${JSON.stringify(
            redactSensitiveFields({ identifier: trimmed }),
          )}`,
        );

        if (status === 401 || status === 403 || status === 404) {
          throw new UnauthorizedException('Credenciales inválidas en el ecosistema fundacional.');
        }
      }

      throw new BadGatewayException(
        'El servicio central de autenticación no se encuentra disponible temporalmente.',
      );
    }
  }
}

export { ExternalAuthHttpAdapter as RenderAuthHttpAdapter };
