export interface SessionContext {
  readonly sessionId: string;
  readonly userAccountId: string | null;
  readonly username: string | null;
  readonly rol: string | null;
  readonly nickname: string | null;
  readonly roleTag: string | null;
  readonly consentAcceptedAt: Date | null;
  readonly isAccountActive: boolean | null;
}

export interface DeviceSessionJwtPayload {
  readonly sub: string;
  readonly uid: string | null;
  readonly role: string;
  readonly typ: 'device_session';
}
