import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import type {
  ExternalAuthUserResult,
  ExternalRegisterPayload,
  IExternalAuthAdapter,
} from '../interfaces/i-render-auth.adapter';

export const DEFAULT_MOCK_PASSWORD = 'ClaveAsisco2026';

export interface SeedExternalUser {
  readonly externalUserId: number;
  readonly username: string;
  readonly email: string;
  readonly roles: ReadonlyArray<string>;
}

export const MOCK_SEED_EXTERNAL_USERS: ReadonlyArray<SeedExternalUser> = [
  {
    externalUserId: 1,
    username: 'admin.asisco',
    email: 'admin@asisco.org',
    roles: ['ADMIN'],
  },
  {
    externalUserId: 2,
    username: 'maria.acudiente',
    email: 'maria@prueba.com',
    roles: ['ACUDIENTE'],
  },
  {
    externalUserId: 3,
    username: 'carlos.voluntario',
    email: 'carlos@asisco.org',
    roles: ['VOLUNTARIO'],
  },
];

interface MockStoredUser extends ExternalAuthUserResult {
  readonly clave: string;
}

@Injectable()
export class ExternalAuthMockAdapter implements IExternalAuthAdapter {
  private readonly users = new Map<number, MockStoredUser>();
  private nextId = 100;

  constructor() {
    for (const seed of MOCK_SEED_EXTERNAL_USERS) {
      const primaryRole = seed.roles.includes('ADMIN') ? 'ADMIN' : (seed.roles[0] ?? 'ACUDIENTE');
      this.users.set(seed.externalUserId, {
        externalUserId: seed.externalUserId,
        username: seed.username,
        email: seed.email,
        rol: primaryRole,
        roles: [...seed.roles],
        clave: DEFAULT_MOCK_PASSWORD,
      });
    }
  }

  registerUser(payload: ExternalRegisterPayload): Promise<ExternalAuthUserResult> {
    const normalizedUsername = payload.username.trim().toLowerCase();
    const normalizedEmail = payload.email.trim().toLowerCase();

    for (const existing of this.users.values()) {
      if (
        existing.username.toLowerCase() === normalizedUsername ||
        existing.email.toLowerCase() === normalizedEmail
      ) {
        throw new ConflictException(
          'El username o email ya se encuentra registrado en el ecosistema fundacional.',
        );
      }
    }

    const externalUserId = this.nextId++;
    const normalizedRol = payload.rol.trim().toUpperCase();
    const stored: MockStoredUser = {
      externalUserId,
      username: payload.username.trim(),
      email: normalizedEmail,
      rol: normalizedRol,
      roles: [normalizedRol],
      clave: payload.clave,
    };

    this.users.set(externalUserId, stored);

    return Promise.resolve({
      externalUserId: stored.externalUserId,
      username: stored.username,
      email: stored.email,
      rol: stored.rol,
      roles: stored.roles,
      externalToken: `opaque-mock-token-${externalUserId}`,
      expiresAt: '8h',
    });
  }

  authenticateUser(identifier: string, clave: string): Promise<ExternalAuthUserResult> {
    const normalized = identifier.trim().toLowerCase();

    for (const existing of this.users.values()) {
      const matchesIdentity =
        existing.username.toLowerCase() === normalized ||
        existing.email.toLowerCase() === normalized;

      if (matchesIdentity && existing.clave === clave) {
        return Promise.resolve({
          externalUserId: existing.externalUserId,
          username: existing.username,
          email: existing.email,
          rol: existing.rol,
          roles: existing.roles,
          externalToken: `opaque-mock-token-${existing.externalUserId ?? 0}`,
          expiresAt: '8h',
        });
      }
    }

    throw new UnauthorizedException('Correo o contraseña incorrectos.');
  }
}

export { ExternalAuthMockAdapter as RenderAuthMockAdapter };
