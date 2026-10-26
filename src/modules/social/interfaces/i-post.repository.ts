import type { ModerationStatus } from '../../../common/enums/moderation-status.enum';
import type { ReactionType } from '../../../common/enums/reaction-type.enum';
import type { Post } from '../entities/post.entity';

export interface ApprovedPostProjection {
  readonly id: string;
  readonly categoryId: string;
  readonly content: string;
  readonly imageUrl: string | null;
  readonly createdAt: Date;
  readonly userAccountId: string | null;
  readonly username: string | null;
  readonly rol: string | null;
  readonly nickname: string | null;
  readonly roleTag: string | null;
}

export interface ApprovedCommentProjection {
  readonly id: string;
  readonly postId: string;
  readonly content: string;
  readonly createdAt: Date;
  readonly userAccountId: string | null;
  readonly username: string | null;
  readonly rol: string | null;
  readonly nickname: string | null;
  readonly roleTag: string | null;
}

export interface ReactionCountsMap {
  readonly LIKE: number;
  readonly SUPPORT: number;
  readonly THANKS: number;
}

export interface CreatePostData {
  readonly deviceId: string;
  readonly userAccountId: string | null;
  readonly categoryId: string;
  readonly content: string;
  readonly imageUrl: string | null;
}

export interface IPostRepository {
  findApprovedPaginated(
    categoryId: string | undefined,
    skip: number,
    take: number,
  ): Promise<{ items: ApprovedPostProjection[]; total: number }>;
  countReactionsByPostIds(
    postIds: ReadonlyArray<string>,
  ): Promise<Map<string, Record<ReactionType, number>>>;
  countApprovedCommentsByPostIds(postIds: ReadonlyArray<string>): Promise<Map<string, number>>;
  findRecentApprovedComments(
    postIds: ReadonlyArray<string>,
    perPostLimit: number,
  ): Promise<Map<string, ApprovedCommentProjection[]>>;
  create(data: CreatePostData): Promise<Post>;
  findStatusById(id: string): Promise<ModerationStatus | null>;
}

export const POST_REPOSITORY = Symbol('POST_REPOSITORY');
