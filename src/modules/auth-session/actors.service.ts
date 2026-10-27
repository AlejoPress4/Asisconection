import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { SessionContext } from '../../common/auth/interfaces/session-context.interface';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { buildPaginationMeta } from '../../common/dto/pagination.util';
import type {
  ActorConnectionResponseDto,
  ActorConnectionsPageDto,
  ActorProfileResponseDto,
  CreateConnectionDto,
  UpdateActorProfileDto,
  UpdateConnectionStatusDto,
} from './dto/actor-profile.dto';
import type { Actor } from './entities/actor.entity';
import type { ActorConnection } from './entities/actor-connection.entity';
import { ACTOR_REPOSITORY, type IActorRepository } from './interfaces/i-actor.repository';

@Injectable()
export class ActorsService {
  constructor(
    @Inject(ACTOR_REPOSITORY)
    private readonly actorRepository: IActorRepository,
  ) {}

  async getMyProfile(session: SessionContext): Promise<ActorProfileResponseDto> {
    const userAccountId = this.requireRegisteredUser(session);
    const actor = await this.actorRepository.ensureForUserAccount(
      userAccountId,
      session.rol ?? 'ACUDIENTE',
    );
    return this.mapActorDto(actor, session.username ?? 'usuario');
  }

  async updateMyProfile(
    session: SessionContext,
    dto: UpdateActorProfileDto,
  ): Promise<ActorProfileResponseDto> {
    const userAccountId = this.requireRegisteredUser(session);
    const updated = await this.actorRepository.updateByUserAccountId(
      userAccountId,
      session.rol ?? 'ACUDIENTE',
      {
        primaryRole: dto.primary_role,
        firstNames: dto.first_names,
        lastNames: dto.last_names,
        avatarUrl: dto.avatar_url,
        shortBio: dto.short_bio,
      },
    );
    return this.mapActorDto(updated, session.username ?? 'usuario');
  }

  async getActorById(actorId: string): Promise<ActorProfileResponseDto> {
    const actor = await this.actorRepository.findById(actorId);
    if (!actor) {
      throw new NotFoundException('El perfil Actor solicitado no existe.');
    }
    return this.mapActorDto(actor, actor.userAccount?.username ?? 'usuario');
  }

  async createConnection(
    session: SessionContext,
    dto: CreateConnectionDto,
  ): Promise<ActorConnectionResponseDto> {
    const userAccountId = this.requireRegisteredUser(session);
    const myActor = await this.actorRepository.ensureForUserAccount(
      userAccountId,
      session.rol ?? 'ACUDIENTE',
    );

    if (myActor.id === dto.receiver_actor_id) {
      throw new BadRequestException('No puede enviar una solicitud de conexión a su propio perfil.');
    }

    const receiver = await this.actorRepository.findById(dto.receiver_actor_id);
    if (!receiver) {
      throw new NotFoundException('El perfil Actor destinatario no existe.');
    }

    const connection = await this.actorRepository.createConnection(
      myActor.id,
      dto.receiver_actor_id,
    );
    return this.mapConnectionDto(connection);
  }

  async updateConnectionStatus(
    session: SessionContext,
    connectionId: string,
    dto: UpdateConnectionStatusDto,
  ): Promise<ActorConnectionResponseDto> {
    const userAccountId = this.requireRegisteredUser(session);
    const myActor = await this.actorRepository.ensureForUserAccount(
      userAccountId,
      session.rol ?? 'ACUDIENTE',
    );

    const existing = await this.actorRepository.findConnectionById(connectionId);
    if (!existing) {
      throw new NotFoundException('La conexión solicitada no existe.');
    }

    const isParticipant =
      existing.receiverActorId === myActor.id || existing.requesterActorId === myActor.id;
    if (!isParticipant) {
      throw new ForbiddenException('No tiene permisos para modificar esta conexión.');
    }

    if (dto.status === 'ACCEPTED' && existing.receiverActorId !== myActor.id) {
      throw new ForbiddenException('Solo el perfil receptor puede aceptar la solicitud de conexión.');
    }

    const updated = await this.actorRepository.updateConnectionStatus(connectionId, dto.status);
    if (!updated) {
      throw new NotFoundException('La conexión solicitada no existe.');
    }

    return this.mapConnectionDto(updated);
  }

  async listMyConnections(
    session: SessionContext,
    query: PaginationQueryDto,
  ): Promise<ActorConnectionsPageDto> {
    const userAccountId = this.requireRegisteredUser(session);
    const myActor = await this.actorRepository.ensureForUserAccount(
      userAccountId,
      session.rol ?? 'ACUDIENTE',
    );

    const { items, total } = await this.actorRepository.listConnectionsForActor(
      myActor.id,
      query.skip,
      query.limit,
    );

    return {
      data: items.map((c) => this.mapConnectionDto(c)),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  private requireRegisteredUser(session: SessionContext): string {
    if (!session.userAccountId) {
      throw new ForbiddenException(
        'Los perfiles Actor y las conexiones están disponibles únicamente para usuarios registrados.',
      );
    }
    return session.userAccountId;
  }

  private mapActorDto(actor: Actor, fallbackUsername: string): ActorProfileResponseDto {
    return {
      id: actor.id,
      user_account_id: actor.userAccountId,
      username: actor.userAccount?.username ?? fallbackUsername,
      primary_role: actor.primaryRole,
      first_names: actor.firstNames,
      last_names: actor.lastNames,
      avatar_url: actor.avatarUrl,
      short_bio: actor.shortBio,
      created_at: actor.createdAt.toISOString(),
      updated_at: actor.updatedAt.toISOString(),
    };
  }

  private mapConnectionDto(connection: ActorConnection): ActorConnectionResponseDto {
    return {
      id: connection.id,
      requester_actor_id: connection.requesterActorId,
      receiver_actor_id: connection.receiverActorId,
      status: connection.status,
      requested_at: connection.requestedAt.toISOString(),
      accepted_at: connection.acceptedAt ? connection.acceptedAt.toISOString() : null,
    };
  }
}
