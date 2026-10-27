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

function readOptionalInt(record: Record<string, unknown>, key: string): number | null {
  const raw = record[key];
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.trunc(raw);
  }
  if (typeof raw === 'string' && /^\d+$/.test(raw.trim())) {
    return Number.parseInt(raw.trim(), 10);
  }
  return null;
}

function readRolesArray(record: Record<string, unknown>): string[] {
  const rawRoles = record['roles'];
  if (Array.isArray(rawRoles)) {
    const normalized = rawRoles
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim().toUpperCase());
    if (normalized.length > 0) {
      return Array.from(new Set(normalized));
    }
  }
  const singleRol = readOptionalString(record, 'rol') ?? readOptionalString(record, 'role');
  if (singleRol) {
    return [singleRol.trim().toUpperCase()];
  }
  return [];
}

function parseExternalUserResponse(
  data: unknown,
  fallback: { username?: string; email?: string; rol?: string },
): ExternalAuthUserResult {
  const root = asRecord(data);
  const nestedUser = root
    ? (asRecord(root['usuario']) ?? asRecord(root['user']) ?? asRecord(root['data']))
    : null;
  const source = nestedUser ?? root ?? {};

  const externalUserId =
    readOptionalInt(source, 'usuarioId') ??
    readOptionalInt(source, 'id') ??
    readOptionalInt(source, 'userId') ??
    (root ? (readOptionalInt(root, 'usuarioId') ?? readOptionalInt(root, 'id')) : null);

  const username = readOptionalString(source, 'username') ?? fallback.username ?? '';
  const email = readOptionalString(source, 'email') ?? fallback.email ?? '';

  const extractedRoles = readRolesArray(source);
  const rootRoles = root ? readRolesArray(root) : [];
  const roles =
    extractedRoles.length > 0
      ? extractedRoles
      : rootRoles.length > 0
        ? rootRoles
        : [fallback.rol ? fallback.rol.trim().toUpperCase() : 'ACUDIENTE'];

  const primaryRole = roles.includes('ADMIN') ? 'ADMIN' : (roles[0] ?? 'ACUDIENTE');
  const externalToken = root ? (readOptionalString(root, 'token') ?? undefined) : undefined;
  const expiresAt = root ? (readOptionalString(root, 'expiraEn') ?? undefined) : undefined;

  if (!username && !email) {
    throw new BadGatewayException(
      'La respuesta recibida desde el servicio externo de autenticación es incompleta.',
    );
  }

  return {
    externalUserId,
    username: username || email,
    email: email || `${username}@asisco.local`,
    rol: primaryRole,
    roles,
    externalToken,
    expiresAt,
  };
}

@Injectable()
export class ExternalAuthHttpAdapter implements IExternalAuthAdapter {
  private readonly logger = new Logger(ExternalAuthHttpAdapter.name);
  private readonly registerPath: string;
  private readonly loginPath: string;
  private readonly profilePath: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {
    this.registerPath = this.configService.get('RENDER_REGISTER_PATH', { infer: true });
    this.loginPath = this.configService.get('RENDER_LOGIN_PATH', { infer: true });
    this.profilePath = this.configService.get('RENDER_PROFILE_PATH', { infer: true });
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

        if (status === 429) {
          throw new BadGatewayException(
            'El servicio central de identidad alcanzó su límite temporal de peticiones. Intente en unos minutos.',
          );
        }

        if (status !== undefined && status >= 400 && status < 500 && status !== 404) {
          throw new ConflictException(
            'El username o email ya se encuentra registrado en el servicio central. Puede iniciar sesión con su cuenta existente.',
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
      : { email: trimmed, username: trimmed, clave };

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

        if (status === 429) {
          throw new BadGatewayException(
            'El servicio central de identidad alcanzó su límite temporal de peticiones. Intente en unos minutos.',
          );
        }

        if (status === 400 || status === 401 || status === 403 || status === 404) {
          throw new UnauthorizedException('Correo o contraseña incorrectos.');
        }
      }

      throw new BadGatewayException(
        'El servicio central de autenticación no se encuentra disponible temporalmente.',
      );
    }
  }

  async getProfile(externalToken: string): Promise<ExternalAuthUserResult> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<unknown>(this.profilePath, {
          headers: { Authorization: `Bearer ${externalToken}` },
        }),
      );
      return parseExternalUserResponse(response.data, {});
    } catch (error: unknown) {
      if (isAxiosError(error) && error.response?.status === 401) {
        throw new UnauthorizedException('El token del servicio externo ha expirado o es inválido.');
      }
      throw new BadGatewayException(
        'No fue posible consultar el perfil en el servicio central de identidad.',
      );
    }
  }
}

export { ExternalAuthHttpAdapter as RenderAuthHttpAdapter };
