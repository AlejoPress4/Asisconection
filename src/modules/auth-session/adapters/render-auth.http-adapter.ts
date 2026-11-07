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

type JsonRecord = Record<string, unknown>;

const asRecord = (val: unknown): JsonRecord | null =>
  typeof val === 'object' && val !== null && !Array.isArray(val) ? (val as JsonRecord) : null;

const readStr = (rec: JsonRecord, key: string): string | null => {
  const val = rec[key];
  if (typeof val === 'string' && val.trim()) return val.trim();
  if (typeof val === 'number' && Number.isFinite(val)) return String(val);
  return null;
};

const readInt = (rec: JsonRecord, key: string): number | null => {
  const val = rec[key];
  if (typeof val === 'number' && Number.isFinite(val)) return Math.trunc(val);
  if (typeof val === 'string' && /^\d+$/.test(val.trim())) return Number.parseInt(val.trim(), 10);
  return null;
};

const readRoles = (rec: JsonRecord): string[] => {
  if (Array.isArray(rec['roles'])) {
    const list = rec['roles']
      .filter((r): r is string => typeof r === 'string' && r.trim().length > 0)
      .map((r) => r.trim().toUpperCase());
    if (list.length > 0) return Array.from(new Set(list));
  }
  const single = readStr(rec, 'rol') ?? readStr(rec, 'role');
  return single ? [single.toUpperCase()] : [];
};

function parseExternalUser(
  data: unknown,
  fallback: { username?: string; email?: string; rol?: string },
): ExternalAuthUserResult {
  const root = asRecord(data);
  const source =
    (root && (asRecord(root['usuario']) ?? asRecord(root['user']) ?? asRecord(root['data']))) ??
    root ??
    {};

  const externalUserId =
    readInt(source, 'usuarioId') ??
    readInt(source, 'id') ??
    readInt(source, 'userId') ??
    (root ? (readInt(root, 'usuarioId') ?? readInt(root, 'id')) : null);

  const username = readStr(source, 'username') ?? fallback.username ?? '';
  const email = readStr(source, 'email') ?? fallback.email ?? '';
  if (!username && !email) {
    throw new BadGatewayException(
      'La respuesta recibida desde el servicio externo de autenticación es incompleta.',
    );
  }

  const roles =
    readRoles(source).length > 0
      ? readRoles(source)
      : root && readRoles(root).length > 0
        ? readRoles(root)
        : [fallback.rol ? fallback.rol.trim().toUpperCase() : 'ACUDIENTE'];

  return {
    externalUserId,
    username: username || email,
    email: email || `${username}@asisco.local`,
    rol: roles.includes('ADMIN') ? 'ADMIN' : (roles[0] ?? 'ACUDIENTE'),
    roles,
    externalToken: root ? (readStr(root, 'token') ?? undefined) : undefined,
    expiresAt: root ? (readStr(root, 'expiraEn') ?? undefined) : undefined,
  };
}

/**
 * Adaptador HTTP que consume el servicio central de identidad en Render / Supabase
 * (`POST /auth/registro`, `POST /auth/login`, `GET /auth/perfil`).
 */
@Injectable()
export class ExternalAuthHttpAdapter implements IExternalAuthAdapter {
  private readonly logger = new Logger(ExternalAuthHttpAdapter.name);
  private readonly registerPath: string;
  private readonly loginPath: string;
  private readonly profilePath: string;

  constructor(
    private readonly httpService: HttpService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.registerPath = config.get('RENDER_REGISTER_PATH', { infer: true });
    this.loginPath = config.get('RENDER_LOGIN_PATH', { infer: true });
    this.profilePath = config.get('RENDER_PROFILE_PATH', { infer: true });
  }

  async registerUser(payload: ExternalRegisterPayload): Promise<ExternalAuthUserResult> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.post<unknown>(this.registerPath, {
          username: payload.username,
          email: payload.email,
          clave: payload.clave,
          rol: payload.rol,
        }),
      );
      return parseExternalUser(data, payload);
    } catch (error: unknown) {
      if (error instanceof BadGatewayException || error instanceof ConflictException) throw error;
      this.handleExternalError(error, 'registro', {
        username: payload.username,
        email: payload.email,
      });
    }
  }

  async authenticateUser(identifier: string, clave: string): Promise<ExternalAuthUserResult> {
    const trimmed = identifier.trim();
    const isEmail = trimmed.includes('@');
    const body = isEmail ? { email: trimmed, clave } : { email: trimmed, username: trimmed, clave };

    try {
      const { data } = await firstValueFrom(this.httpService.post<unknown>(this.loginPath, body));
      return parseExternalUser(data, {
        username: isEmail ? undefined : trimmed,
        email: isEmail ? trimmed : undefined,
      });
    } catch (error: unknown) {
      if (error instanceof BadGatewayException || error instanceof UnauthorizedException) {
        throw error;
      }
      this.handleExternalError(error, 'login', { identifier: trimmed });
    }
  }

  async getProfile(externalToken: string): Promise<ExternalAuthUserResult> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get<unknown>(this.profilePath, {
          headers: { Authorization: `Bearer ${externalToken}` },
        }),
      );
      return parseExternalUser(data, {});
    } catch (error: unknown) {
      if (isAxiosError(error) && error.response?.status === 401) {
        throw new UnauthorizedException('El token del servicio externo ha expirado o es inválido.');
      }
      throw new BadGatewayException(
        'No fue posible consultar el perfil en el servicio central de identidad.',
      );
    }
  }

  private handleExternalError(
    error: unknown,
    operation: 'registro' | 'login',
    context: Record<string, unknown>,
  ): never {
    if (isAxiosError(error)) {
      const status = error.response?.status;
      this.logger.warn(
        `Fallo en ${operation} hacia Render (status=${status ?? 'network'}): ${JSON.stringify(
          redactSensitiveFields(context),
        )}`,
      );

      if (status === 429) {
        throw new BadGatewayException(
          'El servicio central de identidad alcanzó su límite temporal de peticiones. Intente en unos minutos.',
        );
      }
      if (operation === 'registro' && status && status >= 400 && status < 500 && status !== 404) {
        throw new ConflictException(
          'El username o email ya se encuentra registrado en el servicio central. Puede iniciar sesión con su cuenta existente.',
        );
      }
      if (
        operation === 'login' &&
        (status === 400 || status === 401 || status === 403 || status === 404)
      ) {
        throw new UnauthorizedException('Correo o contraseña incorrectos.');
      }
    }

    throw new BadGatewayException(
      'El servicio central de autenticación no se encuentra disponible temporalmente.',
    );
  }
}

export { ExternalAuthHttpAdapter as RenderAuthHttpAdapter };
