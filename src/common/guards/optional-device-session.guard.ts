import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import {
  DEVICE_SESSION_READER,
  type IDeviceSessionReader,
} from '../auth/interfaces/i-device-session-reader';
import { SessionTokenService } from '../auth/session-token.service';
import { extractBearerToken } from './device-session.guard';

@Injectable()
export class OptionalDeviceSessionGuard implements CanActivate {
  constructor(
    private readonly sessionTokenService: SessionTokenService,
    @Inject(DEVICE_SESSION_READER)
    private readonly deviceSessionReader: IDeviceSessionReader,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = extractBearerToken(request.headers.authorization);

    if (!token) {
      return true;
    }

    try {
      const payload = this.sessionTokenService.verify(token);
      const sessionContext = await this.deviceSessionReader.findSessionContext(payload.sub, token);
      if (
        sessionContext &&
        sessionContext.consentAcceptedAt !== null &&
        (sessionContext.userAccountId === null || sessionContext.isAccountActive !== false)
      ) {
        request.sessionContext = sessionContext;
      }
    } catch {
      request.sessionContext = undefined;
    }

    return true;
  }
}
