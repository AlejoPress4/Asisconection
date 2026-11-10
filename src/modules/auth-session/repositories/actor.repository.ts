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
      firstNames: fields.firstNames !== undefined ? fields.firstNames.trim() : current.firstNames,
      lastNames: fields.lastNames !== undefined ? fields.lastNames.trim() : current.lastNames,
      avatarUrl: fields.avatarUrl !== undefined ? fields.avatarUrl.trim() : current.avatarUrl,
      shortBio: fields.shortBio !== undefined ? fields.shortBio.trim() : current.shortBio,
      birthDate:
        fields.birthDate !== undefined ? (fields.birthDate?.trim() ?? null) : current.birthDate,
      city: fields.city !== undefined ? (fields.city?.trim() ?? null) : current.city,
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
    const [postsRows, followersRows, followingRows] = await Promise.all([
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
        .where('ac.receiver_actor_id = :actorId AND ac.status = :status', {
          actorId,
          status: 'ACCEPTED',
        })
        .getCount(),
      this.connectionRepo
        .createQueryBuilder('ac')
        .where('ac.requester_actor_id = :actorId AND ac.status = :status', {
          actorId,
          status: 'ACCEPTED',
        })
        .getCount(),
    ]);

    return {
      postsCount: Number(postsRows[0]?.total ?? 0),
      followersCount: followersRows,
      followingCount: followingRows,
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
  ): Promise<{ items: ActorConnection[]; total: number }> {
    const [items, total] = await this.connectionRepo
      .createQueryBuilder('ac')
      .where('ac.requester_actor_id = :actorId OR ac.receiver_actor_id = :actorId', { actorId })
      .orderBy('ac.requested_at', 'DESC')
      .skip(skip)
      .take(take)
      .getManyAndCount();

    return { items, total };
  }
}
