import { BadGatewayException, Injectable, Optional } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { GlobalUserViewEntity } from '../../../database/external-entities/global-user.view-entity';
import type {
  GlobalUserRecord,
  IGlobalUserRepository,
} from '../interfaces/i-global-user.repository';

@Injectable()
export class GlobalUserRepository implements IGlobalUserRepository {
  constructor(
    @Optional()
    @InjectDataSource('global_db')
    private readonly globalDataSource?: DataSource,
  ) {}

  async findByUsernameOrEmail(identifier: string): Promise<GlobalUserRecord | null> {
    if (!this.globalDataSource) {
      throw new BadGatewayException(
        'La conexión de solo lectura hacia FOUNDATION_GLOBAL_DB no se encuentra disponible.',
      );
    }

    const normalized = identifier.trim().toLowerCase();

    try {
      const entity = await this.globalDataSource
        .getRepository(GlobalUserViewEntity)
        .createQueryBuilder('u')
        .select(['u.id', 'u.username', 'u.email', 'u.rol'])
        .where('LOWER(u.username) = :normalized OR LOWER(u.email) = :normalized', {
          normalized,
        })
        .getOne();

      if (!entity) {
        return null;
      }

      return {
        id: entity.id,
        username: entity.username,
        email: entity.email,
        rol: entity.rol.trim().toUpperCase(),
      };
    } catch {
      throw new BadGatewayException(
        'No fue posible consultar el registro maestro fundacional en FOUNDATION_GLOBAL_DB.',
      );
    }
  }

  async verifyAdminRole(usernameOrEmail: string): Promise<boolean> {
    const user = await this.findByUsernameOrEmail(usernameOrEmail);
    return user !== null && user.rol.trim().toUpperCase() === 'ADMIN';
  }
}
