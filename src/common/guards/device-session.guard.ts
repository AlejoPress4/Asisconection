import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  DEVICE_SESSION_READER,
  type IDeviceSessionReader,
} from '../auth/interfaces/i-device-session-reader';
import { SessionTokenService } from '../auth/session-token.service';

export function extractBearerToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader) {
    return null;
  }
  const [scheme, token] = authorizationHeader.trim().split(/\s+/);
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') {
    return null;
  }
  return token;
}

@Injectable()
export class DeviceSessionGuard implements CanActivate {
  constructor(
    private readonly sessionTokenService: SessionTokenService,
    @Inject(DEVICE_SESSION_READER)
    private readonly deviceSessionReader: IDeviceSessionReader,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('Se requiere un token Bearer de sesión de dispositivo.');
    }

    const payload = this.sessionTokenService.verify(token);
    const sessionContext = await this.deviceSessionReader.findSessionContext(payload.sub, token);

    if (!sessionContext) {
      throw new UnauthorizedException('La sesión del dispositivo no existe o fue reemplazada.');
    }

    if (sessionContext.consentAcceptedAt === null) {
      throw new UnauthorizedException(
        'La sesión no cuenta con aceptación vigente de tratamiento de datos (Ley 1581 de 2012).',
      );
    }

    if (sessionContext.userAccountId !== null && sessionContext.isAccountActive === false) {
      throw new UnauthorizedException('La cuenta asociada a esta sesión se encuentra inactiva.');
    }

    request.sessionContext = sessionContext;
    return true;
  }
}
