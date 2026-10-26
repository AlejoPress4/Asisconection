import type { SessionContext } from './session-context.interface';

export interface IDeviceSessionReader {
  findSessionContext(sessionId: string, token: string): Promise<SessionContext | null>;
}

export const DEVICE_SESSION_READER = Symbol('DEVICE_SESSION_READER');
