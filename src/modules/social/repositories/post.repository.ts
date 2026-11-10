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
  RawAggregatedNotificationRow,
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
  readonly actor_id: string | null;
  readonly avatar_url: string | null;
  readonly username: string | null;
  readonly rol: string | null;
  readonly nickname: string | null;
  readonly role_tag: string | null;
}

interface RawActorLookupRow {
  readonly user_account_id: string;
  readonly id: string;
  readonly avatar_url: string | null;
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
    userAccountId?: string,
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

    if (userAccountId) {
      qb.andWhere('p.userAccountId = :userAccountId', { userAccountId });
    }

    const [entities, total] = await qb
      .orderBy('p.createdAt', 'DESC')
      .skip(skip)
      .take(take)
      .getManyAndCount();

    const postIds = entities.map((p) => p.id);
    const mediaMap = new Map<string, string[]>();
    const actorMap = new Map<string, { id: string; avatarUrl: string | null }>();

    const userAccountIds = Array.from(
      new Set(
        entities
          .map((p) => p.userAccountId)
          .filter((id): id is string => typeof id === 'string'),
      ),
    );

    if (userAccountIds.length > 0) {
      const actorRows = await this.dataSource.query<RawActorLookupRow[]>(
        `
          SELECT user_account_id, id, avatar_url
          FROM actors
          WHERE user_account_id = ANY($1::uuid[])
        `,
        [userAccountIds],
      );
      for (const row of actorRows) {
        actorMap.set(row.user_account_id, { id: row.id, avatarUrl: row.avatar_url });
      }
    }

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
      const actor = post.userAccountId ? actorMap.get(post.userAccountId) : undefined;
      return {
        id: post.id,
        categoryId: post.categoryId,
        content: post.content,
        imageUrl: post.imageUrl ?? mediaList[0] ?? null,
        mediaUrls: mediaList,
        createdAt: post.createdAt,
        userAccountId: post.userAccountId,
        actorId: actor?.id ?? null,
        avatarUrl: actor?.avatarUrl ?? null,
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
          ranked.actor_id,
          ranked.avatar_url,
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
            a.id AS actor_id,
            a.avatar_url,
            ua.username,
            ua.rol,
            ds.nickname,
            ds.role_tag,
            ROW_NUMBER() OVER (PARTITION BY c.post_id ORDER BY c.created_at DESC) AS rn
          FROM comments c
          LEFT JOIN device_sessions ds ON ds.id = c.device_id
          LEFT JOIN user_accounts ua ON ua.id = c.user_account_id
          LEFT JOIN actors a ON a.user_account_id = c.user_account_id
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
        actorId: row.actor_id,
        avatarUrl: row.avatar_url,
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

  async findUserAccountIdByActorId(actorId: string): Promise<string | null> {
    const rows = await this.dataSource.query<Array<{ user_account_id: string }>>(
      `SELECT user_account_id FROM actors WHERE id = $1 OR user_account_id = $1 LIMIT 1`,
      [actorId],
    );
    return rows[0]?.user_account_id ?? null;
  }

  async getLastNotificationsReadAt(userAccountId: string): Promise<Date | null> {
    const rows = await this.dataSource.query<Array<{ last_notifications_read_at: string | Date | null }>>(
      `SELECT last_notifications_read_at FROM actors WHERE user_account_id = $1 LIMIT 1`,
      [userAccountId],
    );
    const dateVal = rows[0]?.last_notifications_read_at;
    return dateVal ? new Date(dateVal) : null;
  }

  async updateLastNotificationsReadAt(userAccountId: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE actors SET last_notifications_read_at = NOW() WHERE user_account_id = $1`,
      [userAccountId],
    );
  }

  async findAggregatedNotifications(
    userAccountId: string,
    deviceId: string,
    since: Date,
  ): Promise<RawAggregatedNotificationRow[]> {
    const query = `
      -- 1. Reactions on my posts
      SELECT r.id,
             'LIKE_ON_POST' AS notif_type,
             'Nueva reacción a tu publicación' AS title,
             CONCAT(COALESCE(NULLIF(TRIM(CONCAT(a.first_names, ' ', a.last_names)), ''), ua.username, ds.nickname, 'Alguien'), ' reaccionó a tu publicación.') AS body,
             r.created_at
      FROM reactions r
      INNER JOIN posts p ON p.id = r.post_id
      LEFT JOIN user_accounts ua ON ua.id = r.user_account_id
      LEFT JOIN actors a ON a.user_account_id = ua.id
      LEFT JOIN device_sessions ds ON ds.id = r.device_id
      WHERE p.user_account_id = $1
        AND (r.user_account_id IS NULL OR r.user_account_id != $1)
        AND (r.device_id != $2)
        AND r.created_at >= $3

      UNION ALL

      -- 2. Direct comments on my posts
      SELECT c.id,
             'COMMENT_ON_POST' AS notif_type,
             'Nuevo comentario en tu publicación' AS title,
             CONCAT(COALESCE(NULLIF(TRIM(CONCAT(a.first_names, ' ', a.last_names)), ''), ua.username, ds.nickname, 'Alguien'), ' comentó tu publicación.') AS body,
             c.created_at
      FROM comments c
      INNER JOIN posts p ON p.id = c.post_id
      LEFT JOIN user_accounts ua ON ua.id = c.user_account_id
      LEFT JOIN actors a ON a.user_account_id = ua.id
      LEFT JOIN device_sessions ds ON ds.id = c.device_id
      WHERE p.user_account_id = $1
        AND (c.user_account_id IS NULL OR c.user_account_id != $1)
        AND (c.device_id != $2)
        AND c.status = 'APPROVED'
        AND c.parent_id IS NULL
        AND c.created_at >= $3

      UNION ALL

      -- 3. Replies to my comments
      SELECT c.id,
             'REPLY_TO_COMMENT' AS notif_type,
             'Respondieron a tu comentario' AS title,
             CONCAT(COALESCE(NULLIF(TRIM(CONCAT(a.first_names, ' ', a.last_names)), ''), ua.username, ds.nickname, 'Alguien'), ' respondió a tu comentario.') AS body,
             c.created_at
      FROM comments c
      INNER JOIN comments parent ON parent.id = c.parent_id
      LEFT JOIN user_accounts ua ON ua.id = c.user_account_id
      LEFT JOIN actors a ON a.user_account_id = ua.id
      LEFT JOIN device_sessions ds ON ds.id = c.device_id
      WHERE parent.user_account_id = $1
        AND (c.user_account_id IS NULL OR c.user_account_id != $1)
        AND (c.device_id != $2)
        AND c.status = 'APPROVED'
        AND c.created_at >= $3

      UNION ALL

      -- 4. Follower connections on my profile
      SELECT ac.id,
             'NEW_FOLLOWER' AS notif_type,
             'Nueva conexión en tu perfil' AS title,
             CONCAT(COALESCE(NULLIF(TRIM(CONCAT(a.first_names, ' ', a.last_names)), ''), ua.username, 'Alguien'), ' comenzó a seguirte.') AS body,
             ac.requested_at AS created_at
      FROM actor_connections ac
      INNER JOIN actors my_actor ON my_actor.id = ac.receiver_actor_id
      INNER JOIN actors a ON a.id = ac.requester_actor_id
      LEFT JOIN user_accounts ua ON ua.id = a.user_account_id
      WHERE my_actor.user_account_id = $1
        AND ac.requested_at >= $3

      UNION ALL

      -- 5. Foundation announcements
      SELECT p.id,
             'FOUNDATION_ANNOUNCEMENT' AS notif_type,
             'Aviso oficial de ASISCO UP' AS title,
             SUBSTRING(p.content FROM 1 FOR 100) AS body,
             p.created_at
      FROM posts p
      INNER JOIN categories cat ON cat.id = p.category_id
      WHERE (cat.name ILIKE '%noticia%' OR cat.name ILIKE '%aviso%')
        AND p.status = 'APPROVED'
        AND (p.user_account_id IS NULL OR p.user_account_id != $1)
        AND p.created_at >= $3

      ORDER BY created_at DESC
      LIMIT 100;
    `;

    const rows = await this.dataSource.query<RawAggregatedNotificationRow[]>(
      query,
      [userAccountId, deviceId, since],
    );

    return rows.map((r) => ({
      ...r,
      created_at: new Date(r.created_at),
    }));
  }
}
