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

const createEmptyReactions = (): Record<ReactionType, number> => ({
  [ReactionType.LIKE]: 0,
  [ReactionType.SUPPORT]: 0,
  [ReactionType.THANKS]: 0,
});

const REACTION_SET: ReadonlySet<string> = new Set<string>(Object.values(ReactionType));

/**
 * Repositorio de publicaciones (`Post`), multimedia (`PostMedia`) y agregaciones ligeras (`RT-01`).
 */
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
      .where('p.status = :status', { status: ModerationStatus.APPROVED });

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
      const mediaRows = await this.dataSource.query<Array<{ post_id: string; media_url: string }>>(
        `
          SELECT post_id, media_url
          FROM post_media
          WHERE post_id = ANY($1::uuid[])
          ORDER BY display_order ASC, created_at ASC
        `,
        [postIds],
      );
      for (const row of mediaRows) {
        const list = mediaMap.get(row.post_id) ?? [];
        list.push(row.media_url);
        mediaMap.set(row.post_id, list);
      }
    }

    const items: ApprovedPostProjection[] = entities.map((post) => {
      const mediaUrls = mediaMap.get(post.id) ?? (post.imageUrl ? [post.imageUrl] : []);
      return {
        id: post.id,
        categoryId: post.categoryId,
        content: post.content,
        imageUrl: post.imageUrl ?? mediaUrls[0] ?? null,
        mediaUrls,
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
    if (postIds.length === 0) return result;

    for (const postId of postIds) {
      result.set(postId, createEmptyReactions());
    }

    const rows = await this.dataSource.query<
      Array<{ post_id: string; type: string; total: number | string }>
    >(
      `
        SELECT post_id, type, COUNT(*)::int AS total
        FROM reactions
        WHERE post_id = ANY($1::uuid[])
        GROUP BY post_id, type
      `,
      [postIds],
    );

    for (const row of rows) {
      const bucket = result.get(row.post_id) ?? createEmptyReactions();
      if (REACTION_SET.has(row.type)) {
        bucket[row.type as ReactionType] = Number(row.total);
      }
      result.set(row.post_id, bucket);
    }

    return result;
  }

  async countApprovedCommentsByPostIds(
    postIds: ReadonlyArray<string>,
  ): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (postIds.length === 0) return result;

    const rows = await this.dataSource.query<Array<{ post_id: string; total: number | string }>>(
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
    if (postIds.length === 0 || perPostLimit <= 0) return result;

    const rows = await this.dataSource.query<RawRecentCommentRow[]>(
      `
        SELECT id, post_id, parent_id, content, created_at, user_account_id, username, rol, nickname, role_tag
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
      const list = result.get(row.post_id) ?? [];
      list.push({
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
      result.set(row.post_id, list);
    }

    return result;
  }

  async create(data: CreatePostData): Promise<Post> {
    return this.dataSource.transaction(async (manager) => {
      const postRepo = manager.getRepository(Post);
      const mediaRepo = manager.getRepository(PostMedia);
      const mediaList = data.mediaUrls?.length
        ? [...data.mediaUrls]
        : data.imageUrl
          ? [data.imageUrl]
          : [];

      const savedPost = await postRepo.save(
        postRepo.create({
          deviceId: data.deviceId,
          userAccountId: data.userAccountId,
          categoryId: data.categoryId,
          content: data.content,
          imageUrl: data.imageUrl ?? mediaList[0] ?? null,
          status: data.status ?? ModerationStatus.PENDING,
          rejectionReason: data.rejectionReason ?? null,
        }),
      );

      if (mediaList.length > 0) {
        await mediaRepo.save(
          mediaList.map((mediaUrl, displayOrder) =>
            mediaRepo.create({ postId: savedPost.id, mediaUrl, displayOrder }),
          ),
        );
      }

      return savedPost;
    });
  }

  async findStatusById(id: string): Promise<ModerationStatus | null> {
    const post = await this.repository.findOne({
      where: { id },
      select: { id: true, status: true },
    });
    return post?.status ?? null;
  }

  async countPostsByDeviceSince(deviceId: string, since: Date): Promise<number> {
    return this.repository
      .createQueryBuilder('p')
      .where('p.device_id = :deviceId AND p.created_at >= :since', { deviceId, since })
      .getCount();
  }
}
