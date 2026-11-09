import type { Actor } from '../entities/actor.entity';
import type {
  ActorConnection,
  ActorConnectionStatus,
} from '../entities/actor-connection.entity';

export interface UpdateActorFields {
  readonly primaryRole?: string;
  readonly firstNames?: string;
  readonly lastNames?: string;
  readonly avatarUrl?: string;
  readonly shortBio?: string;
  readonly birthDate?: string | null;
  readonly city?: string | null;
  readonly showEmail?: boolean;
  readonly showBirthDate?: boolean;
  readonly showCity?: boolean;
  readonly requireFollowApproval?: boolean;
}

export interface ActorStats {
  readonly postsCount: number;
  readonly followersCount: number;
  readonly followingCount: number;
}

export interface IActorRepository {
  findByUserAccountId(userAccountId: string): Promise<Actor | null>;
  findById(actorId: string): Promise<Actor | null>;
  ensureForUserAccount(userAccountId: string, defaultRole: string): Promise<Actor>;
  updateByUserAccountId(userAccountId: string, defaultRole: string, fields: UpdateActorFields): Promise<Actor>;
  getStatsForActor?(actorId: string, userAccountId: string): Promise<ActorStats>;
  createConnection(
    requesterActorId: string,
    receiverActorId: string,
    initialStatus: ActorConnectionStatus,
  ): Promise<ActorConnection>;
  findConnectionById(connectionId: string): Promise<ActorConnection | null>;
  updateConnectionStatus(
    connectionId: string,
    status: ActorConnectionStatus,
  ): Promise<ActorConnection | null>;
  listConnectionsForActor(
    actorId: string,
    skip: number,
    take: number,
  ): Promise<{ items: ActorConnection[]; total: number }>;
}

export const ACTOR_REPOSITORY = Symbol('ACTOR_REPOSITORY');
