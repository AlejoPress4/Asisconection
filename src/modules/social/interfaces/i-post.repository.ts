import type { ModerationStatus } from '../../../common/enums/moderation-status.enum';
import type { ReactionType } from '../../../common/enums/reaction-type.enum';
import type { Post } from '../entities/post.entity';

export interface ApprovedPostProjection {
  readonly id: string;
  readonly categoryId: string;
  readonly content: string;
  readonly imageUrl: string | null;
  readonly mediaUrls?: ReadonlyArray<string>;
  readonly createdAt: Date;
  readonly userAccountId: string | null;
  readonly actorId?: string | null;
  readonly avatarUrl?: string | null;
  readonly firstNames?: string | null;
  readonly lastNames?: string | null;
  readonly primaryRole?: string | null;
  readonly localRole?: string | null;
  readonly username: string | null;
  readonly rol: string | null;
  readonly nickname: string | null;
  readonly roleTag: string | null;
}

export interface ApprovedCommentProjection {
  readonly id: string;
  readonly postId: string;
  readonly parentId?: string | null;
  readonly content: string;
  readonly createdAt: Date;
  readonly userAccountId: string | null;
  readonly actorId?: string | null;
  readonly avatarUrl?: string | null;
  readonly firstNames?: string | null;
  readonly lastNames?: string | null;
  readonly primaryRole?: string | null;
  readonly localRole?: string | null;
  readonly username: string | null;
  readonly rol: string | null;
  readonly nickname: string | null;
  readonly roleTag: string | null;
  readonly likesCount?: number;
  readonly likedByMe?: boolean;
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
  readonly mediaUrls?: ReadonlyArray<string>;
  readonly status?: ModerationStatus;
  readonly rejectionReason?: string | null;
}

export interface UpdatePostData {
  readonly content?: string;
  readonly imageUrl?: string | null;
  readonly mediaUrls?: ReadonlyArray<string>;
  readonly status: ModerationStatus;
  readonly rejectionReason: string | null;
}

export interface FindApprovedPostsOptions {
  readonly search?: string;
  readonly feed?: 'discover' | 'following';
  readonly followerUserAccountId?: string;
}

export interface MyPostSubmissionProjection {
  readonly id: string;
  readonly categoryId: string;
  readonly content: string;
  readonly imageUrl: string | null;
  readonly mediaUrls: ReadonlyArray<string>;
  readonly status: ModerationStatus;
  readonly rejectionReason: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type NotificationEventType =
  | 'COMMENT_ON_POST'
  | 'REPLY_TO_COMMENT'
  | 'LIKE_ON_POST'
  | 'LIKE_ON_COMMENT'
  | 'FOUNDATION_ANNOUNCEMENT'
  | 'NEW_FOLLOWER';

export interface RawAggregatedNotificationRow {
  readonly id: string;
  readonly notif_type: NotificationEventType;
  readonly title: string;
  readonly body: string;
  readonly actor_id?: string | null;
  readonly actor_name?: string | null;
  readonly actor_avatar_url?: string | null;
  readonly post_id?: string | null;
  readonly comment_id?: string | null;
  readonly connection_id?: string | null;
  readonly connection_status?: string | null;
  readonly category_name?: string | null;
  readonly snippet?: string | null;
  readonly created_at: Date;
}

export interface IPostRepository {
  findApprovedPaginated(
    categoryId: string | undefined,
    skip: number,
    take: number,
    userAccountId?: string,
    options?: FindApprovedPostsOptions,
  ): Promise<{ items: ApprovedPostProjection[]; total: number }>;
  findApprovedById?(postId: string): Promise<ApprovedPostProjection | null>;
  findById?(postId: string): Promise<Post | null>;
  updatePost?(postId: string, data: UpdatePostData): Promise<Post | null>;
  deleteById?(postId: string): Promise<boolean>;
  findMySubmissionsPaginated?(
    userAccountId: string,
    status: ModerationStatus | undefined,
    skip: number,
    take: number,
  ): Promise<{ items: MyPostSubmissionProjection[]; total: number }>;
  countReactionsByPostIds(
    postIds: ReadonlyArray<string>,
  ): Promise<Map<string, Record<ReactionType, number>>>;
  findViewerReactionsByPostIds?(
    postIds: ReadonlyArray<string>,
    deviceId: string,
    userAccountId?: string | null,
  ): Promise<Map<string, ReactionType[]>>;
  findBookmarkedPostIds?(
    postIds: ReadonlyArray<string>,
    deviceId: string,
    userAccountId?: string | null,
  ): Promise<Set<string>>;
  toggleBookmark?(
    postId: string,
    deviceId: string,
    userAccountId: string | null,
  ): Promise<boolean>;
  findBookmarkedPostsPaginated?(
    deviceId: string,
    userAccountId: string | null,
    skip: number,
    take: number,
  ): Promise<{ items: ApprovedPostProjection[]; total: number }>;
  countApprovedCommentsByPostIds(postIds: ReadonlyArray<string>): Promise<Map<string, number>>;
  findRecentApprovedComments(
    postIds: ReadonlyArray<string>,
    perPostLimit: number,
  ): Promise<Map<string, ApprovedCommentProjection[]>>;
  create(data: CreatePostData): Promise<Post>;
  findStatusById(id: string): Promise<ModerationStatus | null>;
  countPostsByDeviceSince?(deviceId: string, since: Date): Promise<number>;
  findUserAccountIdByActorId?(actorId: string): Promise<string | null>;
  findAggregatedNotifications?(
    userAccountId: string,
    deviceId: string,
    since: Date,
  ): Promise<RawAggregatedNotificationRow[]>;
  getLastNotificationsReadAt?(userAccountId: string): Promise<Date | null>;
  updateLastNotificationsReadAt?(userAccountId: string): Promise<void>;
}

export const POST_REPOSITORY = Symbol('POST_REPOSITORY');
