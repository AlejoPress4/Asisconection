import { HttpService } from '@nestjs/axios';
import {
  BadGatewayException,
  BadRequestException,
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

function hasExplicitUserFields(data: unknown): boolean {
  const root = asRecord(data);
  if (!root) {
    return false;
  }
  const nestedUser =
    asRecord(root['usuario']) ?? asRecord(root['user']) ?? asRecord(root['data']);
  const source = nestedUser ?? root;
  const hasUsername = readOptionalString(source, 'username') !== null;
  const hasRoles =
    readRolesArray(source).length > 0 || (root ? readRolesArray(root).length > 0 : false);
  return hasUsername && hasRoles;
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

function extractExternalErrorMessage(data: unknown): string | null {
  if (typeof data === 'string' && data.trim().length > 0) {
    return data.trim();
  }
  const record = asRecord(data);
  if (!record) {
    return null;
  }
  const direct =
    readOptionalString(record, 'error') ??
    readOptionalString(record, 'message') ??
    readOptionalString(record, 'detail');
  if (direct) {
    return direct;
  }
  const rawMessage = record['message'];
  if (Array.isArray(rawMessage)) {
    const joined = rawMessage
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .join(' ');
    return joined.length > 0 ? joined : null;
  }
  return null;
}

function isDuplicateErrorMessage(message: string | null): boolean {
  if (!message) {
    return false;
  }
  return /(ya\s+existe|registrad|duplicad|en\s+uso|already|exists|unique|conflict)/i.test(message);
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
      const initialResult = parseExternalUserResponse(response.data, {
        username: payload.username,
        email: payload.email,
        rol: payload.rol,
      });
      if (initialResult.externalToken && !hasExplicitUserFields(response.data)) {
        return await this.enrichWithProfile(initialResult, {
          username: payload.username,
          email: payload.email,
          rol: payload.rol,
        });
      }
      return initialResult;
    } catch (error: unknown) {
      if (
        error instanceof BadGatewayException ||
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      if (isAxiosError(error)) {
        const status = error.response?.status;
        const externalMessage = extractExternalErrorMessage(error.response?.data);
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

        if (
          status === 409 ||
          (status !== undefined &&
            status >= 400 &&
            status < 500 &&
            status !== 404 &&
            isDuplicateErrorMessage(externalMessage))
        ) {
          if (externalMessage && /(email|correo)/i.test(externalMessage)) {
            throw new ConflictException(
              'Ya existe una cuenta registrada con este correo electrónico en el ecosistema de la Fundación. Inicia sesión con tu cuenta existente.',
            );
          }
          if (externalMessage && /(username|usuario)/i.test(externalMessage)) {
            throw new ConflictException(
              'El nombre de usuario ya está registrado en el ecosistema de la Fundación. Elige otro nombre de usuario.',
            );
          }
          throw new ConflictException(
            'Ya existe una cuenta registrada con este correo electrónico o nombre de usuario en el ecosistema de la Fundación. Inicia sesión con tu cuenta existente.',
          );
        }

        if (status === 400 || status === 422) {
          throw new BadRequestException(
            externalMessage ?? 'Los datos de registro no son válidos. Verifica el formulario.',
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
      const fallback = {
        username: trimmed.includes('@') ? undefined : trimmed,
        email: trimmed.includes('@') ? trimmed : undefined,
      };
      const initialResult = parseExternalUserResponse(response.data, fallback);
      if (initialResult.externalToken && !hasExplicitUserFields(response.data)) {
        return await this.enrichWithProfile(initialResult, fallback);
      }
      return initialResult;
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

  private async enrichWithProfile(
    initialResult: ExternalAuthUserResult,
    fallback: { username?: string; email?: string; rol?: string },
  ): Promise<ExternalAuthUserResult> {
    if (!initialResult.externalToken) {
      return initialResult;
    }
    try {
      const profileResponse = await firstValueFrom(
        this.httpService.get<unknown>(this.profilePath, {
          headers: { Authorization: `Bearer ${initialResult.externalToken}` },
        }),
      );
      const enriched = parseExternalUserResponse(profileResponse.data, {
        username: fallback.username ?? initialResult.username,
        email: fallback.email ?? initialResult.email,
        rol: fallback.rol ?? initialResult.rol,
      });
      return {
        ...enriched,
        externalUserId: enriched.externalUserId ?? initialResult.externalUserId,
        externalToken: initialResult.externalToken,
        expiresAt: initialResult.expiresAt ?? enriched.expiresAt,
      };
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.warn(
        'No fue posible enriquecer el perfil desde /auth/perfil tras autenticación; se conserva el resultado base.',
      );
      return initialResult;
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
