import type { SessionContext } from '../auth/interfaces/session-context.interface';

declare global {
  namespace Express {
    interface Request {
      sessionContext?: SessionContext;
    }
  }
}

export {};
