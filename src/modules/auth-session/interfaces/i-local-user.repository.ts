import type { Actor } from '../entities/actor.entity';
import type { DeviceSession } from '../entities/device-session.entity';
import type { UserAccount } from '../entities/user-account.entity';

export interface IssueSessionTokenParams {
  readonly sessionId: string;
  readonly userAccountId: string | null;
  readonly role: string;
}

export interface SyncUserSessionInput {
  readonly externalUserId: number | null;
  readonly username: string;
  readonly email: string;
  readonly rol: string;
  readonly externalRoles?: ReadonlyArray<string>;
  readonly existingAnonymousSessionId?: string;
  readonly signSessionToken: (params: IssueSessionTokenParams) => string;
}

export interface CreateAnonymousSessionInput {
  readonly nickname?: string;
  readonly roleTag?: string;
  readonly signSessionToken: (params: IssueSessionTokenParams) => string;
}

export interface IUserSyncRepository {
  upsertUserAndSession(
    input: SyncUserSessionInput,
  ): Promise<{ user: UserAccount; actor: Actor; session: DeviceSession }>;
  createAnonymousSession(input: CreateAnonymousSessionInput): Promise<DeviceSession>;
  findByIdentity(
    externalUserId: number | null,
    username: string,
    email: string,
  ): Promise<UserAccount | null>;
}

export const USER_SYNC_REPOSITORY = Symbol('USER_SYNC_REPOSITORY');
