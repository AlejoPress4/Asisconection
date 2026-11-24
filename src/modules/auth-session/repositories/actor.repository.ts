import { ConflictException, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import type { DataSource, Repository } from 'typeorm';
import { ModerationStatus } from '../../../common/enums/moderation-status.enum';
import { Actor } from '../entities/actor.entity';
import {
  ActorConnection,
  type ActorConnectionStatus,
} from '../entities/actor-connection.entity';
import type {
  ActorStats,
  IActorRepository,
  ListConnectionsFilter,
  SearchActorsFilter,
  UpdateActorFields,
} from '../interfaces/i-actor.repository';

interface RawCountRow {
  readonly total: number | string;
}

@Injectable()
export class ActorRepository implements IActorRepository, OnModuleInit {
  private readonly logger = new Logger(ActorRepository.name);

  constructor(
    @InjectRepository(Actor)
    private readonly actorRepo: Repository<Actor>,
    @InjectRepository(ActorConnection)
    private readonly connectionRepo: Repository<ActorConnection>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.dataSource.query(`
        ALTER TABLE "actors"
          ADD COLUMN IF NOT EXISTS "birth_date" varchar(20) NULL,
          ADD COLUMN IF NOT EXISTS "city" varchar(80) NULL,
          ADD COLUMN IF NOT EXISTS "show_email" boolean NOT NULL DEFAULT false,
          ADD COLUMN IF NOT EXISTS "show_birth_date" boolean NOT NULL DEFAULT false,
          ADD COLUMN IF NOT EXISTS "show_city" boolean NOT NULL DEFAULT false,
          ADD COLUMN IF NOT EXISTS "require_follow_approval" boolean NOT NULL DEFAULT false,
          ADD COLUMN IF NOT EXISTS "last_notifications_read_at" timestamptz NULL;
      `);
    } catch (error) {
      // Mock / read-only environments: the formal migration remains the source of truth.
      this.logger.warn(
        `No se pudieron asegurar las columnas de privacidad de "actors": ${
          error instanceof Error ? error.message : 'error desconocido'
        }`,
      );
    }
  }

  async findByUserAccountId(userAccountId: string): Promise<Actor | null> {
    return this.actorRepo.findOne({
      where: { userAccountId },
      relations: { userAccount: true },
    });
  }

  async findById(actorId: string): Promise<Actor | null> {
    return this.actorRepo.findOne({
      where: { id: actorId },
      relations: { userAccount: true },
    });
  }

  async ensureForUserAccount(userAccountId: string, defaultRole: string): Promise<Actor> {
    const existing = await this.findByUserAccountId(userAccountId);
    if (existing) {
      return existing;
    }
    const created = this.actorRepo.create({
      userAccountId,
      primaryRole: defaultRole,
      firstNames: null,
      lastNames: null,
      avatarUrl: null,
      shortBio: null,
    });
    await this.actorRepo.save(created);
    return (await this.findByUserAccountId(userAccountId)) ?? created;
  }

  async updateByUserAccountId(
    userAccountId: string,
    defaultRole: string,
    fields: UpdateActorFields,
  ): Promise<Actor> {
    const current = await this.ensureForUserAccount(userAccountId, defaultRole);
    const merged = this.actorRepo.merge(current, {
      primaryRole: fields.primaryRole !== undefined ? fields.primaryRole.trim() : current.primaryRole,
      firstNames:
        fields.firstNames !== undefined ? (fields.firstNames?.trim() || null) : current.firstNames,
      lastNames:
        fields.lastNames !== undefined ? (fields.lastNames?.trim() || null) : current.lastNames,
      avatarUrl:
        fields.avatarUrl !== undefined ? (fields.avatarUrl?.trim() || null) : current.avatarUrl,
      shortBio:
        fields.shortBio !== undefined ? (fields.shortBio?.trim() || null) : current.shortBio,
      birthDate:
        fields.birthDate !== undefined ? (fields.birthDate?.trim() || null) : current.birthDate,
      city: fields.city !== undefined ? (fields.city?.trim() || null) : current.city,
      showEmail: fields.showEmail !== undefined ? fields.showEmail : current.showEmail,
      showBirthDate:
        fields.showBirthDate !== undefined ? fields.showBirthDate : current.showBirthDate,
      showCity: fields.showCity !== undefined ? fields.showCity : current.showCity,
      requireFollowApproval:
        fields.requireFollowApproval !== undefined
          ? fields.requireFollowApproval
          : current.requireFollowApproval,
    });
    await this.actorRepo.save(merged);
    return (await this.findByUserAccountId(userAccountId)) ?? merged;
  }

  async getStatsForActor(actorId: string, userAccountId: string): Promise<ActorStats> {
    const [postsRows, mutualConnectionsCount] = await Promise.all([
      this.dataSource.query<RawCountRow[]>(
        `
          SELECT COUNT(*)::int AS total
          FROM posts
          WHERE user_account_id = $1::uuid
            AND status = $2::"public"."moderation_status_enum"
        `,
        [userAccountId, ModerationStatus.APPROVED],
      ),
      this.connectionRepo
        .createQueryBuilder('ac')
        .where(
          '(ac.requester_actor_id = :actorId OR ac.receiver_actor_id = :actorId) AND ac.status = :status',
          {
            actorId,
            status: 'ACCEPTED',
          },
        )
        .getCount(),
    ]);

    return {
      postsCount: Number(postsRows[0]?.total ?? 0),
      followersCount: mutualConnectionsCount,
      followingCount: mutualConnectionsCount,
    };
  }

  async createConnection(
    requesterActorId: string,
    receiverActorId: string,
    initialStatus: ActorConnectionStatus,
  ): Promise<ActorConnection> {
    const existing = await this.connectionRepo
      .createQueryBuilder('ac')
      .where(
        '(ac.requester_actor_id = :requesterActorId AND ac.receiver_actor_id = :receiverActorId) OR (ac.requester_actor_id = :receiverActorId AND ac.receiver_actor_id = :requesterActorId)',
        { requesterActorId, receiverActorId },
      )
      .getOne();

    if (existing) {
      // Bidirectional friendship: if the other actor already sent a pending request, accept it.
      if (
        existing.status === 'PENDING' &&
        existing.requesterActorId === receiverActorId &&
        existing.receiverActorId === requesterActorId
      ) {
        existing.status = 'ACCEPTED';
        existing.acceptedAt = new Date();
        return this.connectionRepo.save(existing);
      }
      throw new ConflictException('Ya existe una solicitud o conexión entre estos perfiles Actor.');
    }

    const created = this.connectionRepo.create({
      requesterActorId,
      receiverActorId,
      status: initialStatus,
      acceptedAt: initialStatus === 'ACCEPTED' ? new Date() : null,
    });

    return this.connectionRepo.save(created);
  }

  async findConnectionById(connectionId: string): Promise<ActorConnection | null> {
    return this.connectionRepo.findOne({ where: { id: connectionId } });
  }

  async updateConnectionStatus(
    connectionId: string,
    status: ActorConnectionStatus,
  ): Promise<ActorConnection | null> {
    const existing = await this.findConnectionById(connectionId);
    if (!existing) {
      return null;
    }
    existing.status = status;
    existing.acceptedAt = status === 'ACCEPTED' ? new Date() : existing.acceptedAt;
    return this.connectionRepo.save(existing);
  }

  async listConnectionsForActor(
    actorId: string,
    skip: number,
    take: number,
    filter?: ListConnectionsFilter,
  ): Promise<{ items: ActorConnection[]; total: number }> {
    const qb = this.connectionRepo
      .createQueryBuilder('ac')
      .leftJoinAndSelect('ac.requesterActor', 'reqActor')
      .leftJoinAndSelect('reqActor.userAccount', 'reqUa')
      .leftJoinAndSelect('ac.receiverActor', 'recActor')
      .leftJoinAndSelect('recActor.userAccount', 'recUa');

    const direction = filter?.direction ?? 'all';
    if (direction === 'incoming') {
      qb.where('ac.receiver_actor_id = :actorId', { actorId });
    } else if (direction === 'outgoing') {
      qb.where('ac.requester_actor_id = :actorId', { actorId });
    } else {
      qb.where('(ac.requester_actor_id = :actorId OR ac.receiver_actor_id = :actorId)', {
        actorId,
      });
    }

    if (filter?.status) {
      qb.andWhere('ac.status = :status', { status: filter.status });
    }

    const [items, total] = await qb
      .orderBy('ac.requested_at', 'DESC')
      .skip(skip)
      .take(take)
      .getManyAndCount();

    return { items, total };
  }

  async deleteConnection(connectionId: string): Promise<boolean> {
    const result = await this.connectionRepo.delete({ id: connectionId });
    return (result.affected ?? 0) > 0;
  }

  async findConnectionBetweenActors(
    actorAId: string,
    actorBId: string,
  ): Promise<ActorConnection | null> {
    const outgoing = await this.connectionRepo
      .createQueryBuilder('ac')
      .where('ac.requester_actor_id = :actorAId AND ac.receiver_actor_id = :actorBId', {
        actorAId,
        actorBId,
      })
      .getOne();

    if (outgoing) {
      return outgoing;
    }

    return this.connectionRepo
      .createQueryBuilder('ac')
      .where('ac.requester_actor_id = :actorBId AND ac.receiver_actor_id = :actorAId', {
        actorAId,
        actorBId,
      })
      .getOne();
  }

  async searchActors(filter: SearchActorsFilter): Promise<{ items: Actor[]; total: number }> {
    const qb = this.actorRepo
      .createQueryBuilder('a')
      .innerJoinAndSelect('a.userAccount', 'ua')
      .where('ua.is_active = true');

    if (filter.role && filter.role.trim().length > 0) {
      qb.andWhere('UPPER(a.primary_role) = UPPER(:role)', { role: filter.role.trim() });
    }

    if (filter.search && filter.search.trim().length > 0) {
      const pattern = `%${filter.search.trim()}%`;
      qb.andWhere(
        '(ua.username ILIKE :pattern OR a.first_names ILIKE :pattern OR a.last_names ILIKE :pattern OR a.short_bio ILIKE :pattern OR (a.show_city = true AND a.city ILIKE :pattern))',
        { pattern },
      );
    }

    const [items, total] = await qb
      .orderBy('a.created_at', 'DESC')
      .skip(filter.skip)
      .take(filter.take)
      .getManyAndCount();

    return { items, total };
  }

  async listFollowers(
    actorId: string,
    skip: number,
    take: number,
  ): Promise<{ items: Actor[]; total: number }> {
    return this.listAcceptedPeers(actorId, skip, take);
  }

  async listFollowing(
    actorId: string,
    skip: number,
    take: number,
  ): Promise<{ items: Actor[]; total: number }> {
    return this.listAcceptedPeers(actorId, skip, take);
  }

  private async listAcceptedPeers(
    actorId: string,
    skip: number,
    take: number,
  ): Promise<{ items: Actor[]; total: number }> {
    const [connections, total] = await this.connectionRepo
      .createQueryBuilder('ac')
      .innerJoinAndSelect('ac.requesterActor', 'reqActor')
      .innerJoinAndSelect('reqActor.userAccount', 'reqUa')
      .innerJoinAndSelect('ac.receiverActor', 'recActor')
      .innerJoinAndSelect('recActor.userAccount', 'recUa')
      .where(
        '(ac.requester_actor_id = :actorId OR ac.receiver_actor_id = :actorId) AND ac.status = :status',
        {
          actorId,
          status: 'ACCEPTED',
        },
      )
      .orderBy('ac.accepted_at', 'DESC')
      .skip(skip)
      .take(take)
      .getManyAndCount();

    const seenPeerIds = new Set<string>();
    const items: Actor[] = [];
    for (const connection of connections) {
      const peer =
        connection.requesterActorId === actorId
          ? connection.receiverActor
          : connection.requesterActor;
      if (peer && !seenPeerIds.has(peer.id)) {
        seenPeerIds.add(peer.id);
        items.push(peer);
      }
    }

    return { items, total };
  }
}
