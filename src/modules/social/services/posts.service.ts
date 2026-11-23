import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SessionContext } from '../../../common/auth/interfaces/session-context.interface';
import type { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { buildPaginationMeta } from '../../../common/dto/pagination.util';
import { ModerationStatus } from '../../../common/enums/moderation-status.enum';
import { ReactionType } from '../../../common/enums/reaction-type.enum';
import type { EnvironmentVariables } from '../../../config/env.validation';
import { ContentFilterService } from '../../moderation/content-filter.service';
import type { AuthorBadgeDto } from '../dto/author-badge.dto';
import type { CommentsPageDto } from '../dto/comments-page.dto';
import type { CreateCommentDto } from '../dto/create-comment.dto';
import type { CreatePostDto } from '../dto/create-post.dto';
import type {
  ListMySubmissionsQueryDto,
  ListPostsQueryDto,
} from '../dto/list-posts-query.dto';
import type {
  NotificationItemDto,
  NotificationsPageDto,
  NotificationsReadResponseDto,
} from '../dto/notifications-page.dto';
import type { PendingSubmissionResponseDto } from '../dto/pending-submission-response.dto';
import type { PostsPageDto } from '../dto/posts-page.dto';
import type { PublicPostItemDto } from '../dto/public-post-item.dto';
import type {
  DeletedResourceResponseDto,
  MyPostSubmissionsPageDto,
  ToggleBookmarkResponseDto,
  UpdatePostDto,
} from '../dto/social-lifecycle.dto';
import type {
  ToggleCommentReactionResponseDto,
  ToggleReactionResponseDto,
} from '../dto/toggle-reaction-response.dto';
import type { ToggleReactionDto } from '../dto/toggle-reaction.dto';
import {
  CATEGORY_REPOSITORY,
  type ICategoryRepository,
} from '../interfaces/i-category.repository';
import {
  COMMENT_REPOSITORY,
  type ICommentRepository,
} from '../interfaces/i-comment.repository';
import {
  type ApprovedPostProjection,
  type IPostRepository,
  POST_REPOSITORY,
} from '../interfaces/i-post.repository';
import {
  type IReactionRepository,
  REACTION_REPOSITORY,
} from '../interfaces/i-reaction.repository';

export const PENDING_MODERATION_MESSAGE =
  'Contenido recibido y enviado a moderación humana antes de su publicación.';

export const APPROVED_MODERATION_MESSAGE =
  'Contenido publicado y aprobado exitosamente.';

export const AUTO_REJECTED_MODERATION_MESSAGE =
  'Contenido rechazado automáticamente por infringir las políticas de protección comunitaria.';

export interface AuthorSourceFields {
  readonly userAccountId: string | null;
  readonly actorId?: string | null;
  readonly avatarUrl?: string | null;
  readonly username: string | null;
  readonly rol: string | null;
  readonly nickname: string | null;
  readonly roleTag: string | null;
}

export function buildAuthorBadge(source: AuthorSourceFields): AuthorBadgeDto {
  return {
    ...(source.actorId !== undefined ? { actor_id: source.actorId } : {}),
    display_name: source.username ?? source.nickname ?? 'Participante',
    role_label: source.rol ?? source.roleTag ?? 'VISITANTE',
    ...(source.avatarUrl !== undefined ? { avatar_url: source.avatarUrl } : {}),
    is_registered: source.userAccountId !== null,
  };
}

@Injectable()
export class PostsService {
  constructor(
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepository: ICategoryRepository,
    @Inject(POST_REPOSITORY)
    private readonly postRepository: IPostRepository,
    @Inject(COMMENT_REPOSITORY)
    private readonly commentRepository: ICommentRepository,
    @Inject(REACTION_REPOSITORY)
    private readonly reactionRepository: IReactionRepository,
    @Optional()
    private readonly contentFilterService?: ContentFilterService,
    @Optional()
    private readonly configService?: ConfigService<EnvironmentVariables, true>,
  ) {}

  async listApproved(
    query: ListPostsQueryDto,
    userAccountId?: string,
    viewerSession?: SessionContext,
  ): Promise<PostsPageDto> {
    if (query.feed === 'following') {
      if (!viewerSession?.userAccountId) {
        throw new ForbiddenException(
          'El feed personalizado de conexiones (following) está disponible únicamente para usuarios registrados.',
        );
      }
    }

    const hasAdvancedFilter =
      Boolean(query.search && query.search.trim().length > 0) || query.feed === 'following';

    const { items, total } = hasAdvancedFilter
      ? await this.postRepository.findApprovedPaginated(
          query.categoryId,
          query.skip,
          query.limit,
          userAccountId,
          {
            search: query.search,
            feed: query.feed,
            followerUserAccountId: viewerSession?.userAccountId ?? undefined,
          },
        )
      : await this.postRepository.findApprovedPaginated(
          query.categoryId,
          query.skip,
          query.limit,
          userAccountId,
        );

    const data = await this.mapApprovedProjectionsToDto(items, viewerSession);

    return {
      data,
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  private async mapApprovedProjectionsToDto(
    items: ReadonlyArray<ApprovedPostProjection>,
    viewerSession?: SessionContext,
  ): Promise<PublicPostItemDto[]> {
    const postIds = items.map((post) => post.id);
    const [
      reactionsMap,
      commentsCountMap,
      recentCommentsMap,
      viewerReactionsMap,
      bookmarkedIdsSet,
    ] = await Promise.all([
      this.postRepository.countReactionsByPostIds(postIds),
      this.postRepository.countApprovedCommentsByPostIds(postIds),
      this.postRepository.findRecentApprovedComments(postIds, 3),
      viewerSession && this.postRepository.findViewerReactionsByPostIds
        ? this.postRepository.findViewerReactionsByPostIds(
            postIds,
            viewerSession.sessionId,
            viewerSession.userAccountId,
          )
        : Promise.resolve(undefined),
      viewerSession && this.postRepository.findBookmarkedPostIds
        ? this.postRepository.findBookmarkedPostIds(
            postIds,
            viewerSession.sessionId,
            viewerSession.userAccountId,
          )
        : Promise.resolve(undefined),
    ]);

    return items.map((post) => {
      const reactions = reactionsMap.get(post.id);
      const recentComments = recentCommentsMap.get(post.id) ?? [];
      const mediaUrls =
        post.mediaUrls && post.mediaUrls.length > 0
          ? [...post.mediaUrls]
          : post.imageUrl
            ? [post.imageUrl]
            : [];

      return {
        id: post.id,
        category_id: post.categoryId,
        content: post.content,
        image_url: post.imageUrl,
        media_urls: mediaUrls,
        author: buildAuthorBadge(post),
        reactions_summary: {
          LIKE: reactions?.[ReactionType.LIKE] ?? 0,
          SUPPORT: reactions?.[ReactionType.SUPPORT] ?? 0,
          THANKS: reactions?.[ReactionType.THANKS] ?? 0,
        },
        comments_count: commentsCountMap.get(post.id) ?? 0,
        ...(viewerReactionsMap ? { viewer_reactions: viewerReactionsMap.get(post.id) ?? [] } : {}),
        ...(bookmarkedIdsSet ? { is_bookmarked: bookmarkedIdsSet.has(post.id) } : {}),
        recent_comments: recentComments.map((comment) => ({
          id: comment.id,
          parent_id: comment.parentId ?? null,
          content: comment.content,
          author: buildAuthorBadge(comment),
          created_at: comment.createdAt.toISOString(),
        })),
        created_at: post.createdAt.toISOString(),
      };
    });
  }

  async getApprovedPostById(
    postId: string,
    viewerSession?: SessionContext,
  ): Promise<PublicPostItemDto> {
    if (!this.postRepository.findApprovedById) {
      throw new NotFoundException('La publicación solicitada no existe o no se encuentra aprobada.');
    }
    const post = await this.postRepository.findApprovedById(postId);
    if (!post) {
      throw new NotFoundException('La publicación solicitada no existe o no se encuentra aprobada.');
    }

    const mapped = await this.mapApprovedProjectionsToDto([post], viewerSession);
    return mapped[0]!;
  }

  async listMyApprovedPosts(
    session: SessionContext,
    query: PaginationQueryDto,
  ): Promise<PostsPageDto> {
    if (!session.userAccountId) {
      throw new ForbiddenException(
        'Las publicaciones propias están disponibles únicamente para usuarios registrados.',
      );
    }
    return this.listApproved(query, session.userAccountId, session);
  }

  async listActorApprovedPosts(
    actorId: string,
    query: PaginationQueryDto,
    viewerSession?: SessionContext,
  ): Promise<PostsPageDto> {
    if (!this.postRepository.findUserAccountIdByActorId) {
      throw new NotFoundException('El perfil solicitado no existe.');
    }
    const userAccountId = await this.postRepository.findUserAccountIdByActorId(actorId);
    if (!userAccountId) {
      throw new NotFoundException('El perfil solicitado no existe.');
    }
    return this.listApproved(query, userAccountId, viewerSession);
  }

  async listApprovedComments(
    postId: string,
    query: PaginationQueryDto,
  ): Promise<CommentsPageDto> {
    const postStatus = await this.postRepository.findStatusById(postId);
    if (postStatus !== ModerationStatus.APPROVED) {
      throw new NotFoundException('La publicación solicitada no existe o no se encuentra aprobada.');
    }

    if (!this.commentRepository.findApprovedByPostId) {
      return {
        data: [],
        meta: buildPaginationMeta(query.page, query.limit, 0),
      };
    }

    const { items, total } = await this.commentRepository.findApprovedByPostId(
      postId,
      query.skip,
      query.limit,
    );

    return {
      data: items.map((comment) => ({
        id: comment.id,
        parent_id: comment.parentId ?? null,
        content: comment.content,
        author: buildAuthorBadge(comment),
        likes_count: comment.likesCount ?? 0,
        created_at: comment.createdAt.toISOString(),
      })),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  private isPrivilegedModerator(session: SessionContext): boolean {
    if (!session || !session.userAccountId || session.isAccountActive === false) {
      return false;
    }
    const roles = new Set<string>();
    if (session.rol) {
      roles.add(session.rol);
    }
    if (session.externalRoles) {
      for (const role of session.externalRoles) {
        roles.add(role);
      }
    }
    if (session.localRole) {
      roles.add(session.localRole);
    }
    return roles.has('ADMIN') || roles.has('MODERATOR');
  }

  async createPost(
    session: SessionContext,
    dto: CreatePostDto,
  ): Promise<PendingSubmissionResponseDto> {
    const category = this.categoryRepository.findCategoryById
      ? await this.categoryRepository.findCategoryById(dto.category_id)
      : null;
    const categoryExists =
      category !== null || (await this.categoryRepository.existsById(dto.category_id));
    if (!categoryExists) {
      throw new NotFoundException('La categoría temática indicada no existe.');
    }

    if (category) {
      const normalizedName = category.name.trim().toLowerCase();
      const normalizedTopic = (category.mainTopic ?? '').trim().toLowerCase();
      const isInstitutionalCategory =
        normalizedName.includes('noticias') ||
        normalizedName.includes('avisos') ||
        normalizedTopic.includes('institucional') ||
        normalizedTopic.includes('noticias') ||
        normalizedTopic.includes('avisos');

      if (isInstitutionalCategory && !this.isPrivilegedModerator(session)) {
        throw new ForbiddenException(
          'Solo administradores y moderadores pueden publicar en la categoría institucional de Noticias y Avisos.',
        );
      }
    }

    const mediaUrls =
      dto.media_urls && dto.media_urls.length > 0
        ? dto.media_urls
        : dto.image_url
          ? [dto.image_url]
          : [];

    if (mediaUrls.length > 0 && session.consentAcceptedAt === null) {
      throw new ForbiddenException(
        'Para adjuntar imágenes es obligatorio contar con consentimiento legal vigente (Ley 1581 de 2012 y Ley 1098 de 2006).',
      );
    }

    if (session.userAccountId === null && this.postRepository.countPostsByDeviceSince) {
      const maxPostsPerDay =
        this.configService?.get('ANON_MAX_POSTS_PER_DAY', { infer: true }) ?? 3;
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const countToday = await this.postRepository.countPostsByDeviceSince(
        session.sessionId,
        since,
      );
      if (countToday >= maxPostsPerDay) {
        throw new HttpException(
          `Las sesiones anónimas tienen un límite de ${maxPostsPerDay} publicaciones por día. Regístrese o inicie sesión para publicar sin esta restricción.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const filterEvaluation = this.contentFilterService?.evaluate(dto.content);
    let initialStatus: ModerationStatus;
    if (filterEvaluation?.status === ModerationStatus.REJECTED) {
      initialStatus = ModerationStatus.REJECTED;
    } else {
      initialStatus = ModerationStatus.APPROVED;
    }
    const rejectionReason = filterEvaluation?.rejectionReason ?? null;

    const post = await this.postRepository.create({
      deviceId: session.sessionId,
      userAccountId: session.userAccountId,
      categoryId: dto.category_id,
      content: dto.content,
      imageUrl: dto.image_url ?? mediaUrls[0] ?? null,
      mediaUrls,
      status: initialStatus,
      rejectionReason,
    });

    const effectiveStatus = post.status;
    let message = PENDING_MODERATION_MESSAGE;
    if (effectiveStatus === ModerationStatus.REJECTED) {
      message = AUTO_REJECTED_MODERATION_MESSAGE;
    } else if (effectiveStatus === ModerationStatus.APPROVED) {
      message = APPROVED_MODERATION_MESSAGE;
    }

    return {
      id: post.id,
      status: effectiveStatus,
      ...(rejectionReason ? { rejection_reason: rejectionReason } : {}),
      message,
      created_at: post.createdAt.toISOString(),
    };
  }

  async updatePost(
    session: SessionContext,
    postId: string,
    dto: UpdatePostDto,
  ): Promise<PendingSubmissionResponseDto> {
    if (!this.postRepository.findById || !this.postRepository.updatePost) {
      throw new NotFoundException('La publicación solicitada no existe.');
    }

    const existing = await this.postRepository.findById(postId);
    if (!existing) {
      throw new NotFoundException('La publicación solicitada no existe.');
    }

    const isOwner =
      (session.userAccountId !== null && existing.userAccountId === session.userAccountId) ||
      existing.deviceId === session.sessionId;

    if (!isOwner) {
      throw new ForbiddenException('Solo el autor de la publicación puede editarla.');
    }

    if (
      dto.content === undefined &&
      dto.image_url === undefined &&
      dto.media_urls === undefined
    ) {
      throw new BadRequestException(
        'Debe proporcionar al menos un campo (content, image_url o media_urls) para actualizar.',
      );
    }

    const nextMediaUrls =
      dto.media_urls !== undefined
        ? dto.media_urls
        : dto.image_url !== undefined
          ? [dto.image_url]
          : undefined;

    if (nextMediaUrls && nextMediaUrls.length > 0 && session.consentAcceptedAt === null) {
      throw new ForbiddenException(
        'Para adjuntar imágenes es obligatorio contar con consentimiento legal vigente (Ley 1581 de 2012 y Ley 1098 de 2006).',
      );
    }

    const contentToEvaluate = dto.content ?? existing.content;
    const filterEvaluation = this.contentFilterService?.evaluate(contentToEvaluate);
    let nextStatus: ModerationStatus;
    if (filterEvaluation?.status === ModerationStatus.REJECTED) {
      nextStatus = ModerationStatus.REJECTED;
    } else {
      nextStatus = ModerationStatus.APPROVED;
    }
    const rejectionReason = filterEvaluation?.rejectionReason ?? null;

    const updated = await this.postRepository.updatePost(postId, {
      content: dto.content,
      ...(nextMediaUrls !== undefined
        ? {
            imageUrl: dto.image_url ?? nextMediaUrls[0] ?? null,
            mediaUrls: nextMediaUrls,
          }
        : {}),
      status: nextStatus,
      rejectionReason,
    });

    if (!updated) {
      throw new NotFoundException('La publicación solicitada no existe.');
    }

    let message = PENDING_MODERATION_MESSAGE;
    if (updated.status === ModerationStatus.REJECTED) {
      message = AUTO_REJECTED_MODERATION_MESSAGE;
    } else if (updated.status === ModerationStatus.APPROVED) {
      message = APPROVED_MODERATION_MESSAGE;
    }

    return {
      id: updated.id,
      status: updated.status,
      ...(rejectionReason ? { rejection_reason: rejectionReason } : {}),
      message,
      created_at: updated.createdAt.toISOString(),
    };
  }

  async deletePost(
    session: SessionContext,
    postId: string,
  ): Promise<DeletedResourceResponseDto> {
    if (!this.postRepository.findById || !this.postRepository.deleteById) {
      throw new NotFoundException('La publicación solicitada no existe.');
    }

    const existing = await this.postRepository.findById(postId);
    if (!existing) {
      throw new NotFoundException('La publicación solicitada no existe.');
    }

    const isOwner =
      (session.userAccountId !== null && existing.userAccountId === session.userAccountId) ||
      existing.deviceId === session.sessionId;

    if (!isOwner && !this.isPrivilegedModerator(session)) {
      throw new ForbiddenException('No tiene permisos para eliminar esta publicación.');
    }

    await this.postRepository.deleteById(postId);
    return {
      id: postId,
      deleted: true,
    };
  }

  async deleteComment(
    session: SessionContext,
    commentId: string,
  ): Promise<DeletedResourceResponseDto> {
    if (!this.commentRepository.findById || !this.commentRepository.deleteById) {
      throw new NotFoundException('El comentario solicitado no existe.');
    }

    const existing = await this.commentRepository.findById(commentId);
    if (!existing) {
      throw new NotFoundException('El comentario solicitado no existe.');
    }

    const isOwner =
      (session.userAccountId !== null && existing.userAccountId === session.userAccountId) ||
      existing.deviceId === session.sessionId;

    if (!isOwner && !this.isPrivilegedModerator(session)) {
      throw new ForbiddenException('No tiene permisos para eliminar este comentario.');
    }

    await this.commentRepository.deleteById(commentId);
    return {
      id: commentId,
      deleted: true,
    };
  }

  async listMySubmissions(
    session: SessionContext,
    query: ListMySubmissionsQueryDto,
  ): Promise<MyPostSubmissionsPageDto> {
    if (!session.userAccountId) {
      throw new ForbiddenException(
        'El historial de publicaciones enviadas a moderación está disponible únicamente para usuarios registrados.',
      );
    }

    if (!this.postRepository.findMySubmissionsPaginated) {
      return {
        data: [],
        meta: buildPaginationMeta(query.page, query.limit, 0),
      };
    }

    const { items, total } = await this.postRepository.findMySubmissionsPaginated(
      session.userAccountId,
      query.status,
      query.skip,
      query.limit,
    );

    return {
      data: items.map((item) => ({
        id: item.id,
        category_id: item.categoryId,
        content: item.content,
        image_url: item.imageUrl,
        media_urls: [...item.mediaUrls],
        status: item.status,
        rejection_reason: item.rejectionReason,
        created_at: item.createdAt.toISOString(),
        updated_at: item.updatedAt.toISOString(),
      })),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async toggleBookmark(
    session: SessionContext,
    postId: string,
  ): Promise<ToggleBookmarkResponseDto> {
    const postStatus = await this.postRepository.findStatusById(postId);
    if (postStatus !== ModerationStatus.APPROVED) {
      throw new NotFoundException('La publicación solicitada no existe o no se encuentra aprobada.');
    }

    const bookmarked = this.postRepository.toggleBookmark
      ? await this.postRepository.toggleBookmark(
          postId,
          session.sessionId,
          session.userAccountId,
        )
      : false;

    return {
      post_id: postId,
      bookmarked,
    };
  }

  async listBookmarks(
    session: SessionContext,
    query: PaginationQueryDto,
  ): Promise<PostsPageDto> {
    if (!this.postRepository.findBookmarkedPostsPaginated) {
      return {
        data: [],
        meta: buildPaginationMeta(query.page, query.limit, 0),
      };
    }

    const { items, total } = await this.postRepository.findBookmarkedPostsPaginated(
      session.sessionId,
      session.userAccountId,
      query.skip,
      query.limit,
    );

    const data = await this.mapApprovedProjectionsToDto(items, session);

    return {
      data,
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async createComment(
    session: SessionContext,
    postId: string,
    dto: CreateCommentDto,
  ): Promise<PendingSubmissionResponseDto> {
    const postStatus = await this.postRepository.findStatusById(postId);
    if (postStatus !== ModerationStatus.APPROVED) {
      throw new NotFoundException('La publicación solicitada no existe o no se encuentra aprobada.');
    }

    if (dto.parent_id && this.commentRepository.findById) {
      const parentComment = await this.commentRepository.findById(dto.parent_id);
      if (!parentComment || parentComment.postId !== postId) {
        throw new BadRequestException(
          'El comentario padre indicado no existe o no pertenece a esta publicación.',
        );
      }
    }

    if (session.userAccountId === null && this.commentRepository.countCommentsByDeviceSince) {
      const maxCommentsPerDay =
        this.configService?.get('ANON_MAX_COMMENTS_PER_DAY', { infer: true }) ?? 10;
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const countToday = await this.commentRepository.countCommentsByDeviceSince(
        session.sessionId,
        since,
      );
      if (countToday >= maxCommentsPerDay) {
        throw new HttpException(
          `Las sesiones anónimas tienen un límite de ${maxCommentsPerDay} comentarios por día.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const filterEvaluation = this.contentFilterService?.evaluate(dto.content);
    let initialStatus: ModerationStatus;
    if (filterEvaluation?.status === ModerationStatus.REJECTED) {
      initialStatus = ModerationStatus.REJECTED;
    } else if (this.isPrivilegedModerator(session)) {
      initialStatus = ModerationStatus.APPROVED;
    } else {
      initialStatus = ModerationStatus.PENDING;
    }
    const rejectionReason = filterEvaluation?.rejectionReason ?? null;

    const comment = await this.commentRepository.create({
      postId,
      parentId: dto.parent_id ?? null,
      deviceId: session.sessionId,
      userAccountId: session.userAccountId,
      content: dto.content,
      status: initialStatus,
      rejectionReason,
    });

    const effectiveStatus = comment.status;
    let message = PENDING_MODERATION_MESSAGE;
    if (effectiveStatus === ModerationStatus.REJECTED) {
      message = AUTO_REJECTED_MODERATION_MESSAGE;
    } else if (effectiveStatus === ModerationStatus.APPROVED) {
      message = APPROVED_MODERATION_MESSAGE;
    }

    return {
      id: comment.id,
      status: effectiveStatus,
      ...(rejectionReason ? { rejection_reason: rejectionReason } : {}),
      message,
      created_at: comment.createdAt.toISOString(),
    };
  }

  async toggleReaction(
    session: SessionContext,
    postId: string,
    dto: ToggleReactionDto,
  ): Promise<ToggleReactionResponseDto> {
    const postStatus = await this.postRepository.findStatusById(postId);
    if (postStatus !== ModerationStatus.APPROVED) {
      throw new NotFoundException('La publicación solicitada no existe o no se encuentra aprobada.');
    }

    const active = await this.reactionRepository.toggle(
      postId,
      session.sessionId,
      session.userAccountId,
      dto.type,
    );

    return {
      post_id: postId,
      type: dto.type,
      active,
    };
  }

  async toggleCommentReaction(
    session: SessionContext,
    commentId: string,
    dto: ToggleReactionDto,
  ): Promise<ToggleCommentReactionResponseDto> {
    if (this.commentRepository.findById) {
      const comment = await this.commentRepository.findById(commentId);
      if (!comment || comment.status !== ModerationStatus.APPROVED) {
        throw new NotFoundException('El comentario solicitado no existe o no se encuentra aprobado.');
      }
    }

    const active = this.reactionRepository.toggleCommentReaction
      ? await this.reactionRepository.toggleCommentReaction(
          commentId,
          session.sessionId,
          session.userAccountId,
          dto.type,
        )
      : false;

    return {
      comment_id: commentId,
      type: dto.type,
      active,
    };
  }

  async listNotifications(
    session: SessionContext,
    query: PaginationQueryDto,
  ): Promise<NotificationsPageDto> {
    if (!session.userAccountId) {
      return {
        data: [],
        meta: buildPaginationMeta(query.page, query.limit, 0),
      };
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    let lastReadAt: Date | null = null;
    if (this.postRepository.getLastNotificationsReadAt) {
      lastReadAt = await this.postRepository.getLastNotificationsReadAt(session.userAccountId);
    }

    if (this.postRepository.findAggregatedNotifications) {
      const rawItems = await this.postRepository.findAggregatedNotifications(
        session.userAccountId,
        session.sessionId,
        thirtyDaysAgo,
      );

      const mapped: NotificationItemDto[] = rawItems.map((item) => {
        const itemCreated = new Date(item.created_at);
        const isRead = lastReadAt ? itemCreated.getTime() <= lastReadAt.getTime() : false;
        return {
          id: item.id,
          type: item.notif_type,
          title: item.title,
          body: item.body,
          is_read: isRead,
          created_at: itemCreated.toISOString(),
        };
      });

      const paged = mapped.slice(query.skip, query.skip + query.limit);

      return {
        data: paged,
        meta: buildPaginationMeta(query.page, query.limit, mapped.length),
      };
    }

    // Fallback if findAggregatedNotifications is not implemented (e.g. standard mocks)
    const { items: myPosts } = await this.postRepository.findApprovedPaginated(
      undefined,
      0,
      20,
      session.userAccountId,
    );
    if (myPosts.length === 0) {
      return {
        data: [],
        meta: buildPaginationMeta(query.page, query.limit, 0),
      };
    }

    const recentCommentsMap = await this.postRepository.findRecentApprovedComments(
      myPosts.map((post) => post.id),
      5,
    );
    const thirtyDaysAgoMs = thirtyDaysAgo.getTime();
    const notifications: NotificationItemDto[] = myPosts
      .flatMap((post) => {
        const comments = recentCommentsMap.get(post.id) ?? [];
        return comments
          .filter(
            (comment) =>
              comment.userAccountId !== session.userAccountId &&
              comment.createdAt.getTime() >= thirtyDaysAgoMs,
          )
          .map((comment) => {
            const actor = buildAuthorBadge(comment);
            const isRead = lastReadAt ? comment.createdAt.getTime() <= lastReadAt.getTime() : false;
            return {
              id: comment.id,
              type: 'COMMENT_ON_POST' as const,
              title: 'Nuevo comentario en tu publicación',
              body: `${actor.display_name} comentó en tu publicación.`,
              is_read: isRead,
              created_at: comment.createdAt.toISOString(),
            };
          });
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at));

    const paged = notifications.slice(query.skip, query.skip + query.limit);

    return {
      data: paged,
      meta: buildPaginationMeta(query.page, query.limit, notifications.length),
    };
  }

  async markNotificationsRead(session: SessionContext): Promise<NotificationsReadResponseDto> {
    if (session.userAccountId && this.postRepository.updateLastNotificationsReadAt) {
      await this.postRepository.updateLastNotificationsReadAt(session.userAccountId);
    }
    return {
      marked_read: true,
      updated_at: new Date().toISOString(),
    };
  }
}
