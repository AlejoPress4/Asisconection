import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { SessionContext } from '../auth/interfaces/session-context.interface';

export const CurrentSession = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SessionContext | undefined => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.sessionContext;
  },
);
