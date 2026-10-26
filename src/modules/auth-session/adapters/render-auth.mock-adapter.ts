import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type {
  ExternalAuthUserResult,
  ExternalRegisterPayload,
  IExternalAuthAdapter,
} from '../interfaces/i-render-auth.adapter';
import { MOCK_GLOBAL_USERS } from '../repositories/global-user.mock-repository';

export const DEFAULT_MOCK_PASSWORD = 'ClaveAsisco2026';

interface MockStoredUser extends ExternalAuthUserResult {
  readonly clave: string;
}

@Injectable()
export class ExternalAuthMockAdapter implements IExternalAuthAdapter {
  private readonly users = new Map<string, MockStoredUser>();

  constructor() {
    for (const globalUser of MOCK_GLOBAL_USERS) {
      this.users.set(globalUser.id, {
        externalUserId: globalUser.id,
        username: globalUser.username,
        email: globalUser.email,
        rol: globalUser.rol,
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

    const externalUserId = `ext-mock-${randomUUID()}`;
    const stored: MockStoredUser = {
      externalUserId,
      username: payload.username.trim(),
      email: payload.email.trim().toLowerCase(),
      rol: payload.rol.trim().toUpperCase(),
      clave: payload.clave,
    };

    this.users.set(externalUserId, stored);

    return Promise.resolve({
      externalUserId: stored.externalUserId,
      username: stored.username,
      email: stored.email,
      rol: stored.rol,
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
          rol: existing.rol.trim().toUpperCase(),
        });
      }
    }

    throw new UnauthorizedException('Credenciales inválidas en el ecosistema fundacional.');
  }
}

export { ExternalAuthMockAdapter as RenderAuthMockAdapter };
