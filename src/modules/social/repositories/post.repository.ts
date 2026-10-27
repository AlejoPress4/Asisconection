import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import type { DataSource, Repository } from 'typeorm';
import { ModerationStatus } from '../../../common/enums/moderation-status.enum';
import { ReactionType } from '../../../common/enums/reaction-type.enum';
import { PostMedia } from '../entities/post-media.entity';
import { Post } from '../entities/post.entity';
import type {
  ApprovedCommentProjection,
  ApprovedPostProjection,
  CreatePostData,
  IPostRepository,
} from '../interfaces/i-post.repository';

interface RawReactionCountRow {
  readonly post_id: string;
  readonly type: string;
  readonly total: number | string;
}

interface RawCommentCountRow {
  readonly post_id: string;
  readonly total: number | string;
}

interface RawRecentCommentRow {
  readonly id: string;
  readonly post_id: string;
  readonly parent_id: string | null;
  readonly content: string;
  readonly created_at: Date | string;
  readonly user_account_id: string | null;
  readonly username: string | null;
  readonly rol: string | null;
  readonly nickname: string | null;
  readonly role_tag: string | null;
}

interface RawPostMediaRow {
  readonly post_id: string;
  readonly media_url: string;
}

function createEmptyReactionMap(): Record<ReactionType, number> {
  return {
    [ReactionType.LIKE]: 0,
    [ReactionType.SUPPORT]: 0,
    [ReactionType.THANKS]: 0,
  };
}

const REACTION_TYPES: ReadonlySet<string> = new Set<string>(Object.values(ReactionType));

function isReactionType(value: string): value is ReactionType {
  return REACTION_TYPES.has(value);
}

@Injectable()
export class PostRepository implements IPostRepository {
  constructor(
    @InjectRepository(Post)
    private readonly repository: Repository<Post>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async findApprovedPaginated(
    categoryId: string | undefined,
    skip: number,
    take: number,
  ): Promise<{ items: ApprovedPostProjection[]; total: number }> {
    const qb = this.repository
      .createQueryBuilder('p')
      .leftJoin('p.device', 'ds')
      .leftJoin('p.userAccount', 'ua')
      .select([
        'p.id',
        'p.categoryId',
        'p.content',
        'p.imageUrl',
        'p.createdAt',
        'p.userAccountId',
        'ds.id',
        'ds.nickname',
        'ds.roleTag',
        'ua.id',
        'ua.username',
        'ua.rol',
      ])
      .where('p.status = :approvedStatus', { approvedStatus: ModerationStatus.APPROVED });

    if (categoryId) {
      qb.andWhere('p.categoryId = :categoryId', { categoryId });
    }

    const [entities, total] = await qb
      .orderBy('p.createdAt', 'DESC')
      .skip(skip)
      .take(take)
      .getManyAndCount();

    const postIds = entities.map((p) => p.id);
    const mediaMap = new Map<string, string[]>();

    if (postIds.length > 0) {
      const mediaRows = await this.dataSource.query<RawPostMediaRow[]>(
        `
          SELECT post_id, media_url
          FROM post_media
          WHERE post_id = ANY($1::uuid[])
          ORDER BY display_order ASC, created_at ASC
        `,
        [postIds],
      );
      for (const row of mediaRows) {
        const current = mediaMap.get(row.post_id) ?? [];
        current.push(row.media_url);
        mediaMap.set(row.post_id, current);
      }
    }

    const items: ApprovedPostProjection[] = entities.map((post) => {
      const mediaList = mediaMap.get(post.id) ?? (post.imageUrl ? [post.imageUrl] : []);
      return {
        id: post.id,
        categoryId: post.categoryId,
        content: post.content,
        imageUrl: post.imageUrl ?? mediaList[0] ?? null,
        mediaUrls: mediaList,
        createdAt: post.createdAt,
        userAccountId: post.userAccountId,
        username: post.userAccount?.username ?? null,
        rol: post.userAccount?.rol ?? null,
        nickname: post.device?.nickname ?? null,
        roleTag: post.device?.roleTag ?? null,
      };
    });

    return { items, total };
  }

  async countReactionsByPostIds(
    postIds: ReadonlyArray<string>,
  ): Promise<Map<string, Record<ReactionType, number>>> {
    const result = new Map<string, Record<ReactionType, number>>();
    if (postIds.length === 0) {
      return result;
    }

    for (const postId of postIds) {
      result.set(postId, createEmptyReactionMap());
    }

    const rows = await this.dataSource.query<RawReactionCountRow[]>(
      `
        SELECT post_id, type, COUNT(*)::int AS total
        FROM reactions
        WHERE post_id = ANY($1::uuid[])
        GROUP BY post_id, type
      `,
      [postIds],
    );

    for (const row of rows) {
      const bucket = result.get(row.post_id) ?? createEmptyReactionMap();
      if (isReactionType(row.type)) {
        bucket[row.type] = Number(row.total);
      }
      result.set(row.post_id, bucket);
    }

    return result;
  }

  async countApprovedCommentsByPostIds(
    postIds: ReadonlyArray<string>,
  ): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (postIds.length === 0) {
      return result;
    }

    const rows = await this.dataSource.query<RawCommentCountRow[]>(
      `
        SELECT post_id, COUNT(*)::int AS total
        FROM comments
        WHERE status = $2::"public"."moderation_status_enum" AND post_id = ANY($1::uuid[])
        GROUP BY post_id
      `,
      [postIds, ModerationStatus.APPROVED],
    );

    for (const row of rows) {
      result.set(row.post_id, Number(row.total));
    }

    return result;
  }

  async findRecentApprovedComments(
    postIds: ReadonlyArray<string>,
    perPostLimit: number,
  ): Promise<Map<string, ApprovedCommentProjection[]>> {
    const result = new Map<string, ApprovedCommentProjection[]>();
    if (postIds.length === 0 || perPostLimit <= 0) {
      return result;
    }

    const rows = await this.dataSource.query<RawRecentCommentRow[]>(
      `
        SELECT
          ranked.id,
          ranked.post_id,
          ranked.parent_id,
          ranked.content,
          ranked.created_at,
          ranked.user_account_id,
          ranked.username,
          ranked.rol,
          ranked.nickname,
          ranked.role_tag
        FROM (
          SELECT
            c.id,
            c.post_id,
            c.parent_id,
            c.content,
            c.created_at,
            c.user_account_id,
            ua.username,
            ua.rol,
            ds.nickname,
            ds.role_tag,
            ROW_NUMBER() OVER (PARTITION BY c.post_id ORDER BY c.created_at DESC) AS rn
          FROM comments c
          LEFT JOIN device_sessions ds ON ds.id = c.device_id
          LEFT JOIN user_accounts ua ON ua.id = c.user_account_id
          WHERE c.status = $2::"public"."moderation_status_enum" AND c.post_id = ANY($1::uuid[])
        ) AS ranked
        WHERE ranked.rn <= $3
        ORDER BY ranked.created_at DESC
      `,
      [postIds, ModerationStatus.APPROVED, perPostLimit],
    );

    for (const row of rows) {
      const existing = result.get(row.post_id) ?? [];
      existing.push({
        id: row.id,
        postId: row.post_id,
        parentId: row.parent_id,
        content: row.content,
        createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
        userAccountId: row.user_account_id,
        username: row.username,
        rol: row.rol,
        nickname: row.nickname,
        roleTag: row.role_tag,
      });
      result.set(row.post_id, existing);
    }

    return result;
  }

  async create(data: CreatePostData): Promise<Post> {
    return this.dataSource.transaction(async (manager) => {
      const postRepo = manager.getRepository(Post);
      const mediaRepo = manager.getRepository(PostMedia);

      const mediaList =
        data.mediaUrls && data.mediaUrls.length > 0
          ? [...data.mediaUrls]
          : data.imageUrl
            ? [data.imageUrl]
            : [];

      const entity = postRepo.create({
        deviceId: data.deviceId,
        userAccountId: data.userAccountId,
        categoryId: data.categoryId,
        content: data.content,
        imageUrl: data.imageUrl ?? mediaList[0] ?? null,
        status: data.status ?? ModerationStatus.PENDING,
        rejectionReason: data.rejectionReason ?? null,
      });

      const savedPost = await postRepo.save(entity);

      if (mediaList.length > 0) {
        const mediaEntities = mediaList.map((url, idx) =>
          mediaRepo.create({
            postId: savedPost.id,
            mediaUrl: url,
            displayOrder: idx,
          }),
        );
        await mediaRepo.save(mediaEntities);
      }

      return savedPost;
    });
  }

  async findStatusById(id: string): Promise<ModerationStatus | null> {
    const post = await this.repository
      .createQueryBuilder('p')
      .select(['p.id', 'p.status'])
      .where('p.id = :id', { id })
      .getOne();

    return post ? post.status : null;
  }

  async countPostsByDeviceSince(deviceId: string, since: Date): Promise<number> {
    return this.repository
      .createQueryBuilder('p')
      .where('p.device_id = :deviceId AND p.created_at >= :since', { deviceId, since })
      .getCount();
  }
}
