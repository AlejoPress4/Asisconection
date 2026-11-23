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
  ActorsPageDto,
  ConnectionPeerActorDto,
  CreateConnectionDto,
  DeleteConnectionResponseDto,
  ListActorsQueryDto,
  ListConnectionsQueryDto,
  UpdateActorProfileDto,
  UpdateConnectionStatusDto,
  ViewerConnectionStatusDto,
} from './dto/actor-profile.dto';
import type { Actor } from './entities/actor.entity';
import type { ActorConnection, ActorConnectionStatus } from './entities/actor-connection.entity';
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
    const stats = this.actorRepository.getStatsForActor
      ? await this.actorRepository.getStatsForActor(actor.id, userAccountId)
      : undefined;
    return this.mapActorDto(actor, session.username ?? 'usuario', {
      includeEmail: true,
      stats,
    });
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
        birthDate: dto.birth_date,
        city: dto.city,
        showEmail: dto.show_email,
        showBirthDate: dto.show_birth_date,
        showCity: dto.show_city,
        requireFollowApproval: dto.require_follow_approval,
      },
    );
    const stats = this.actorRepository.getStatsForActor
      ? await this.actorRepository.getStatsForActor(updated.id, userAccountId)
      : undefined;
    return this.mapActorDto(updated, session.username ?? 'usuario', {
      includeEmail: true,
      stats,
    });
  }

  async searchActors(query: ListActorsQueryDto): Promise<ActorsPageDto> {
    if (!this.actorRepository.searchActors) {
      return {
        data: [],
        meta: buildPaginationMeta(query.page, query.limit, 0),
      };
    }

    const { items, total } = await this.actorRepository.searchActors({
      search: query.search,
      role: query.role,
      skip: query.skip,
      take: query.limit,
    });

    const data = await Promise.all(
      items.map(async (actor) => {
        const stats = this.actorRepository.getStatsForActor
          ? await this.actorRepository.getStatsForActor(actor.id, actor.userAccountId)
          : undefined;
        return this.mapActorDto(actor, actor.userAccount?.username ?? 'usuario', {
          includeEmail: false,
          stats,
        });
      }),
    );

    return {
      data,
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async getActorById(
    actorId: string,
    optionalSession?: SessionContext,
  ): Promise<ActorProfileResponseDto> {
    const actor = await this.actorRepository.findById(actorId);
    if (!actor) {
      throw new NotFoundException('El perfil Actor solicitado no existe.');
    }
    const stats = this.actorRepository.getStatsForActor
      ? await this.actorRepository.getStatsForActor(actor.id, actor.userAccountId)
      : undefined;

    let viewerConnection: ViewerConnectionStatusDto | null | undefined;
    if (
      optionalSession?.userAccountId &&
      optionalSession.userAccountId !== actor.userAccountId &&
      this.actorRepository.findConnectionBetweenActors
    ) {
      const viewerActor = await this.actorRepository.findByUserAccountId(
        optionalSession.userAccountId,
      );
      if (viewerActor) {
        const connection = await this.actorRepository.findConnectionBetweenActors(
          viewerActor.id,
          actor.id,
        );
        viewerConnection = connection
          ? {
              connection_id: connection.id,
              status: connection.status,
              direction: connection.requesterActorId === viewerActor.id ? 'OUTGOING' : 'INCOMING',
            }
          : null;
      }
    }

    return this.mapActorDto(actor, actor.userAccount?.username ?? 'usuario', {
      includeEmail: false,
      stats,
      viewerConnection,
    });
  }

  async listFollowers(actorId: string, query: PaginationQueryDto): Promise<ActorsPageDto> {
    const actor = await this.actorRepository.findById(actorId);
    if (!actor) {
      throw new NotFoundException('El perfil Actor solicitado no existe.');
    }

    if (!this.actorRepository.listFollowers) {
      return {
        data: [],
        meta: buildPaginationMeta(query.page, query.limit, 0),
      };
    }

    const { items, total } = await this.actorRepository.listFollowers(
      actor.id,
      query.skip,
      query.limit,
    );

    return {
      data: items.map((item) =>
        this.mapActorDto(item, item.userAccount?.username ?? 'usuario', { includeEmail: false }),
      ),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async listFollowing(actorId: string, query: PaginationQueryDto): Promise<ActorsPageDto> {
    const actor = await this.actorRepository.findById(actorId);
    if (!actor) {
      throw new NotFoundException('El perfil Actor solicitado no existe.');
    }

    if (!this.actorRepository.listFollowing) {
      return {
        data: [],
        meta: buildPaginationMeta(query.page, query.limit, 0),
      };
    }

    const { items, total } = await this.actorRepository.listFollowing(
      actor.id,
      query.skip,
      query.limit,
    );

    return {
      data: items.map((item) =>
        this.mapActorDto(item, item.userAccount?.username ?? 'usuario', { includeEmail: false }),
      ),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
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

    // The receiver decides: manual approval keeps the request PENDING, otherwise it is accepted.
    const initialStatus: ActorConnectionStatus = receiver.requireFollowApproval
      ? 'PENDING'
      : 'ACCEPTED';
    const connection = await this.actorRepository.createConnection(
      myActor.id,
      dto.receiver_actor_id,
      initialStatus,
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
    query: ListConnectionsQueryDto,
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
      {
        status: query.status,
        direction: query.direction,
      },
    );

    return {
      data: items.map((c) => this.mapConnectionDto(c, myActor.id)),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async deleteConnection(
    session: SessionContext,
    connectionId: string,
  ): Promise<DeleteConnectionResponseDto> {
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
      throw new ForbiddenException('No tiene permisos para eliminar esta conexión.');
    }

    if (this.actorRepository.deleteConnection) {
      await this.actorRepository.deleteConnection(connectionId);
    }

    return {
      id: connectionId,
      deleted: true,
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

  private mapActorDto(
    actor: Actor,
    fallbackUsername: string,
    options?: {
      includeEmail?: boolean;
      stats?: { postsCount: number; followersCount: number; followingCount: number };
      viewerConnection?: ViewerConnectionStatusDto | null;
    },
  ): ActorProfileResponseDto {
    const isOwner = Boolean(options?.includeEmail);
    const shouldIncludeEmail = isOwner || actor.showEmail === true;
    const shouldIncludeBirthDate = isOwner || actor.showBirthDate === true;
    const shouldIncludeCity = isOwner || actor.showCity === true;

    return {
      id: actor.id,
      user_account_id: actor.userAccountId,
      username: actor.userAccount?.username ?? fallbackUsername,
      ...(shouldIncludeEmail ? { email: actor.userAccount?.email ?? null } : {}),
      primary_role: actor.primaryRole,
      ...(actor.userAccount?.localRole ? { local_role: actor.userAccount.localRole } : {}),
      first_names: actor.firstNames,
      last_names: actor.lastNames,
      avatar_url: actor.avatarUrl,
      short_bio: actor.shortBio,
      ...(shouldIncludeBirthDate ? { birth_date: actor.birthDate ?? null } : {}),
      ...(shouldIncludeCity ? { city: actor.city ?? null } : {}),
      ...(isOwner
        ? {
            show_email: actor.showEmail ?? false,
            show_birth_date: actor.showBirthDate ?? false,
            show_city: actor.showCity ?? false,
            require_follow_approval: actor.requireFollowApproval ?? false,
          }
        : {}),
      ...(options?.stats
        ? {
            posts_count: options.stats.postsCount,
            followers_count: options.stats.followersCount,
            following_count: options.stats.followingCount,
          }
        : {}),
      ...(options?.viewerConnection !== undefined
        ? { viewer_connection: options.viewerConnection }
        : {}),
      created_at: actor.createdAt.toISOString(),
      updated_at: actor.updatedAt.toISOString(),
    };
  }

  private mapConnectionDto(
    connection: ActorConnection,
    viewerActorId?: string,
  ): ActorConnectionResponseDto {
    const peerActorEntity =
      viewerActorId !== undefined
        ? connection.requesterActorId === viewerActorId
          ? connection.receiverActor
          : connection.requesterActor
        : undefined;

    let peerActor: ConnectionPeerActorDto | undefined;
    if (peerActorEntity) {
      const fullName = [peerActorEntity.firstNames, peerActorEntity.lastNames]
        .filter((part): part is string => Boolean(part && part.trim().length > 0))
        .join(' ')
        .trim();
      const username = peerActorEntity.userAccount?.username ?? 'usuario';
      peerActor = {
        actor_id: peerActorEntity.id,
        username,
        display_name: fullName.length > 0 ? fullName : username,
        primary_role: peerActorEntity.primaryRole,
        avatar_url: peerActorEntity.avatarUrl ?? null,
      };
    }

    return {
      id: connection.id,
      requester_actor_id: connection.requesterActorId,
      receiver_actor_id: connection.receiverActorId,
      status: connection.status,
      ...(peerActor ? { peer_actor: peerActor } : {}),
      requested_at: connection.requestedAt.toISOString(),
      accepted_at: connection.acceptedAt ? connection.acceptedAt.toISOString() : null,
    };
  }
}
