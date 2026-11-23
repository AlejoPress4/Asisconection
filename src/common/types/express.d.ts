import type { SessionContext } from '../auth/interfaces/session-context.interface';

declare global {
  namespace Express {
    interface Request {
      sessionContext?: SessionContext;
    }

    namespace Multer {
      interface File {
        fieldname: string;
        originalname: string;
        encoding: string;
        mimetype: string;
        size: number;
        buffer: Buffer;
      }
    }
  }
}

export {};
