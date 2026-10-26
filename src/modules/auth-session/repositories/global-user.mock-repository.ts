import { Injectable } from '@nestjs/common';
import type {
  GlobalUserRecord,
  IGlobalUserRepository,
} from '../interfaces/i-global-user.repository';

export const MOCK_GLOBAL_USERS: ReadonlyArray<GlobalUserRecord> = [
  {
    id: 'ext-usr-001',
    username: 'maria.acudiente',
    email: 'maria@prueba.com',
    rol: 'ACUDIENTE',
  },
  {
    id: 'ext-usr-002',
    username: 'admin.asisco',
    email: 'admin@asisco.org',
    rol: 'ADMIN',
  },
  {
    id: 'ext-usr-003',
    username: 'carlos.voluntario',
    email: 'carlos@asisco.org',
    rol: 'VOLUNTARIO',
  },
];

@Injectable()
export class GlobalUserMockRepository implements IGlobalUserRepository {
  private readonly users: ReadonlyArray<GlobalUserRecord> = MOCK_GLOBAL_USERS;

  findByUsernameOrEmail(identifier: string): Promise<GlobalUserRecord | null> {
    const normalized = identifier.trim().toLowerCase();
    const found =
      this.users.find(
        (user) =>
          user.username.toLowerCase() === normalized || user.email.toLowerCase() === normalized,
      ) ?? null;

    return Promise.resolve(found);
  }

  async verifyAdminRole(usernameOrEmail: string): Promise<boolean> {
    const found = await this.findByUsernameOrEmail(usernameOrEmail);
    return found !== null && found.rol.trim().toUpperCase() === 'ADMIN';
  }
}
