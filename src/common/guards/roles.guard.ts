import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ROLES_METADATA_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[] | undefined>(
      ROLES_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const session = request.sessionContext;

    if (!session || session.userAccountId === null || session.isAccountActive !== true) {
      throw new ForbiddenException('No cuenta con permisos suficientes para esta operación.');
    }

    const effectiveRoles = new Set<string>();
    if (session.rol) {
      effectiveRoles.add(session.rol);
    }
    if (session.externalRoles) {
      for (const extRole of session.externalRoles) {
        effectiveRoles.add(extRole);
      }
    }
    if (session.localRole) {
      effectiveRoles.add(session.localRole);
    }

    const hasRequiredRole = requiredRoles.some((role) => effectiveRoles.has(role));
    if (!hasRequiredRole) {
      throw new ForbiddenException('No cuenta con permisos suficientes para esta operación.');
    }

    return true;
  }
}
