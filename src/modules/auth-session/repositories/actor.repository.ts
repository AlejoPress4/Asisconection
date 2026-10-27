import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { Actor } from '../entities/actor.entity';
import {
  ActorConnection,
  type ActorConnectionStatus,
} from '../entities/actor-connection.entity';
import type { IActorRepository, UpdateActorFields } from '../interfaces/i-actor.repository';

@Injectable()
export class ActorRepository implements IActorRepository {
  constructor(
    @InjectRepository(Actor)
    private readonly actorRepo: Repository<Actor>,
    @InjectRepository(ActorConnection)
    private readonly connectionRepo: Repository<ActorConnection>,
  ) {}

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
    });
    await this.actorRepo.save(merged);
    return (await this.findByUserAccountId(userAccountId)) ?? merged;
  }

  async createConnection(
    requesterActorId: string,
    receiverActorId: string,
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
      status: 'PENDING',
      acceptedAt: null,
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
