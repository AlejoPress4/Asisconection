import type { Actor } from '../entities/actor.entity';
import type {
  ActorConnection,
  ActorConnectionStatus,
} from '../entities/actor-connection.entity';

export interface UpdateActorFields {
  readonly primaryRole?: string;
  readonly firstNames?: string | null;
  readonly lastNames?: string | null;
  readonly avatarUrl?: string | null;
  readonly shortBio?: string | null;
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

export interface SearchActorsFilter {
  readonly search?: string;
  readonly role?: string;
  readonly skip: number;
  readonly take: number;
}

export interface ListConnectionsFilter {
  readonly status?: ActorConnectionStatus;
  readonly direction?: 'incoming' | 'outgoing' | 'all';
}

export interface IActorRepository {
  findByUserAccountId(userAccountId: string): Promise<Actor | null>;
  findById(actorId: string): Promise<Actor | null>;
  ensureForUserAccount(userAccountId: string, defaultRole: string): Promise<Actor>;
  updateByUserAccountId(userAccountId: string, defaultRole: string, fields: UpdateActorFields): Promise<Actor>;
  getStatsForActor?(actorId: string, userAccountId: string): Promise<ActorStats>;
  searchActors?(filter: SearchActorsFilter): Promise<{ items: Actor[]; total: number }>;
  findConnectionBetweenActors?(actorAId: string, actorBId: string): Promise<ActorConnection | null>;
  listFollowers?(actorId: string, skip: number, take: number): Promise<{ items: Actor[]; total: number }>;
  listFollowing?(actorId: string, skip: number, take: number): Promise<{ items: Actor[]; total: number }>;
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
  deleteConnection?(connectionId: string): Promise<boolean>;
  listConnectionsForActor(
    actorId: string,
    skip: number,
    take: number,
    filter?: ListConnectionsFilter,
  ): Promise<{ items: ActorConnection[]; total: number }>;
}

export const ACTOR_REPOSITORY = Symbol('ACTOR_REPOSITORY');
