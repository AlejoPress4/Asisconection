import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { SessionContext } from '../../../common/auth/interfaces/session-context.interface';
import { buildPaginationMeta } from '../../../common/dto/pagination.util';
import { ModerationStatus } from '../../../common/enums/moderation-status.enum';
import { ReactionType } from '../../../common/enums/reaction-type.enum';
import type { AuthorBadgeDto } from '../dto/author-badge.dto';
import type { CreateCommentDto } from '../dto/create-comment.dto';
import type { CreatePostDto } from '../dto/create-post.dto';
import type { ListPostsQueryDto } from '../dto/list-posts-query.dto';
import type { PendingSubmissionResponseDto } from '../dto/pending-submission-response.dto';
import type { PostsPageDto } from '../dto/posts-page.dto';
import type { PublicPostItemDto } from '../dto/public-post-item.dto';
import type { ToggleReactionResponseDto } from '../dto/toggle-reaction-response.dto';
import type { ToggleReactionDto } from '../dto/toggle-reaction.dto';
import {
  CATEGORY_REPOSITORY,
  type ICategoryRepository,
} from '../interfaces/i-category.repository';
import {
  COMMENT_REPOSITORY,
  type ICommentRepository,
} from '../interfaces/i-comment.repository';
import { type IPostRepository, POST_REPOSITORY } from '../interfaces/i-post.repository';
import {
  type IReactionRepository,
  REACTION_REPOSITORY,
} from '../interfaces/i-reaction.repository';

export const PENDING_MODERATION_MESSAGE =
  'Contenido recibido y enviado a moderación humana antes de su publicación.';

export interface AuthorSourceFields {
  readonly userAccountId: string | null;
  readonly username: string | null;
  readonly rol: string | null;
  readonly nickname: string | null;
  readonly roleTag: string | null;
}

export function buildAuthorBadge(source: AuthorSourceFields): AuthorBadgeDto {
  return {
    display_name: source.username ?? source.nickname ?? 'Participante',
    role_label: source.rol ?? source.roleTag ?? 'VISITANTE',
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
  ) {}

  async listApproved(query: ListPostsQueryDto): Promise<PostsPageDto> {
    const { items, total } = await this.postRepository.findApprovedPaginated(
      query.categoryId,
      query.skip,
      query.limit,
    );

    const postIds = items.map((post) => post.id);
    const [reactionsMap, commentsCountMap, recentCommentsMap] = await Promise.all([
      this.postRepository.countReactionsByPostIds(postIds),
      this.postRepository.countApprovedCommentsByPostIds(postIds),
      this.postRepository.findRecentApprovedComments(postIds, 3),
    ]);

    const data: PublicPostItemDto[] = items.map((post) => {
      const reactions = reactionsMap.get(post.id);
      const recentComments = recentCommentsMap.get(post.id) ?? [];

      return {
        id: post.id,
        category_id: post.categoryId,
        content: post.content,
        image_url: post.imageUrl,
        author: buildAuthorBadge(post),
        reactions_summary: {
          LIKE: reactions?.[ReactionType.LIKE] ?? 0,
          SUPPORT: reactions?.[ReactionType.SUPPORT] ?? 0,
          THANKS: reactions?.[ReactionType.THANKS] ?? 0,
        },
        comments_count: commentsCountMap.get(post.id) ?? 0,
        recent_comments: recentComments.map((comment) => ({
          id: comment.id,
          content: comment.content,
          author: buildAuthorBadge(comment),
          created_at: comment.createdAt.toISOString(),
        })),
        created_at: post.createdAt.toISOString(),
      };
    });

    return {
      data,
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async createPost(
    session: SessionContext,
    dto: CreatePostDto,
  ): Promise<PendingSubmissionResponseDto> {
    const categoryExists = await this.categoryRepository.existsById(dto.category_id);
    if (!categoryExists) {
      throw new NotFoundException('La categoría temática indicada no existe.');
    }

    if (dto.image_url && session.consentAcceptedAt === null) {
      throw new ForbiddenException(
        'Para adjuntar imágenes es obligatorio contar con consentimiento legal vigente (Ley 1581 de 2012 y Ley 1098 de 2006).',
      );
    }

    const post = await this.postRepository.create({
      deviceId: session.sessionId,
      userAccountId: session.userAccountId,
      categoryId: dto.category_id,
      content: dto.content,
      imageUrl: dto.image_url ?? null,
    });

    return {
      id: post.id,
      status: ModerationStatus.PENDING,
      message: PENDING_MODERATION_MESSAGE,
      created_at: post.createdAt.toISOString(),
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

    const comment = await this.commentRepository.create({
      postId,
      deviceId: session.sessionId,
      userAccountId: session.userAccountId,
      content: dto.content,
    });

    return {
      id: comment.id,
      status: ModerationStatus.PENDING,
      message: PENDING_MODERATION_MESSAGE,
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
}
