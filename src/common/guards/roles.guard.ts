import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import {
  GLOBAL_USER_REPOSITORY,
  type IGlobalUserRepository,
} from '../../modules/auth-session/interfaces/i-global-user.repository';
import { ROLES_METADATA_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(GLOBAL_USER_REPOSITORY)
    private readonly globalUserRepository: IGlobalUserRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[] | undefined>(
      ROLES_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const session = request.sessionContext;

    if (
      !session ||
      session.userAccountId === null ||
      session.isAccountActive !== true ||
      session.rol === null ||
      !requiredRoles.includes(session.rol)
    ) {
      throw new ForbiddenException('No cuenta con permisos suficientes para esta operación.');
    }

    if (requiredRoles.includes('ADMIN')) {
      if (!session.username) {
        throw new ForbiddenException('No cuenta con permisos suficientes para esta operación.');
      }
      const isGlobalAdmin = await this.globalUserRepository.verifyAdminRole(session.username);
      if (!isGlobalAdmin) {
        throw new ForbiddenException('No cuenta con permisos suficientes para esta operación.');
      }
    }

    return true;
  }
}
