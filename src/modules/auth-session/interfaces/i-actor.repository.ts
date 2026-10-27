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
}

export interface IActorRepository {
  findByUserAccountId(userAccountId: string): Promise<Actor | null>;
  findById(actorId: string): Promise<Actor | null>;
  ensureForUserAccount(userAccountId: string, defaultRole: string): Promise<Actor>;
  updateByUserAccountId(userAccountId: string, defaultRole: string, fields: UpdateActorFields): Promise<Actor>;
  createConnection(requesterActorId: string, receiverActorId: string): Promise<ActorConnection>;
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
