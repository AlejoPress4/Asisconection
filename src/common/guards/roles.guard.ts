import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ROLES_METADATA_KEY } from '../decorators/roles.decorator';

/**
 * Guard de autorización basado en roles (`ADMIN` desde Render/Supabase y `MODERATOR` global local).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[] | undefined>(
      ROLES_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles?.length) return true;

    const session = context.switchToHttp().getRequest<Request>().sessionContext;
    if (!session || session.userAccountId === null || session.isAccountActive !== true) {
      throw new ForbiddenException('No cuenta con permisos suficientes para esta operación.');
    }

    const effectiveRoles = new Set<string>([
      ...(session.rol ? [session.rol] : []),
      ...(session.externalRoles ?? []),
      ...(session.localRole ? [session.localRole] : []),
    ]);

    if (!requiredRoles.some((role) => effectiveRoles.has(role))) {
      throw new ForbiddenException('No cuenta con permisos suficientes para esta operación.');
    }

    return true;
  }
}
