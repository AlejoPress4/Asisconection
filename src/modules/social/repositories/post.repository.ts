import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import type { DataSource, Repository } from 'typeorm';
import { ModerationStatus } from '../../../common/enums/moderation-status.enum';
import { ReactionType } from '../../../common/enums/reaction-type.enum';
import { PostBookmark } from '../entities/post-bookmark.entity';
import { PostMedia } from '../entities/post-media.entity';
import { Post } from '../entities/post.entity';
import type {
  ApprovedCommentProjection,
  ApprovedPostProjection,
  CreatePostData,
  FindApprovedPostsOptions,
  IPostRepository,
  MyPostSubmissionProjection,
  RawAggregatedNotificationRow,
  UpdatePostData,
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
  readonly first_names: string | null;
  readonly last_names: string | null;
  readonly primary_role: string | null;
  readonly local_role: string | null;
  readonly username: string | null;
  readonly rol: string | null;
  readonly nickname: string | null;
  readonly role_tag: string | null;
}

interface RawActorLookupRow {
  readonly user_account_id: string;
  readonly id: string;
  readonly avatar_url: string | null;
  readonly first_names: string | null;
  readonly last_names: string | null;
  readonly primary_role: string | null;
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
export class PostRepository implements IPostRepository, OnModuleInit {
  private readonly logger = new Logger(PostRepository.name);

  constructor(
    @InjectRepository(Post)
    private readonly repository: Repository<Post>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS "post_bookmarks" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "post_id" uuid NOT NULL,
          "device_id" uuid NOT NULL,
          "user_account_id" uuid NULL,
          "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT "PK_post_bookmarks_id" PRIMARY KEY ("id"),
          CONSTRAINT "UQ_post_bookmarks_post_device" UNIQUE ("post_id", "device_id"),
          CONSTRAINT "FK_post_bookmarks_post" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE,
          CONSTRAINT "FK_post_bookmarks_device" FOREIGN KEY ("device_id") REFERENCES "device_sessions"("id") ON DELETE CASCADE,
          CONSTRAINT "FK_post_bookmarks_user" FOREIGN KEY ("user_account_id") REFERENCES "user_accounts"("id") ON DELETE CASCADE
        );
      `);
    } catch (error) {
      this.logger.warn(
        `No se pudo asegurar la tabla "post_bookmarks": ${
          error instanceof Error ? error.message : 'error desconocido'
        }`,
      );
    }
  }

  async findApprovedPaginated(
    categoryId: string | undefined,
    skip: number,
    take: number,
    userAccountId?: string,
    options?: FindApprovedPostsOptions,
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
        'ua.localRole',
      ])
      .where('p.status = :approvedStatus', { approvedStatus: ModerationStatus.APPROVED });

    if (categoryId) {
      qb.andWhere('p.categoryId = :categoryId', { categoryId });
    }

    if (userAccountId) {
      qb.andWhere('p.userAccountId = :userAccountId', { userAccountId });
    }

    if (options?.search && options.search.trim().length > 0) {
      qb.andWhere('p.content ILIKE :searchPattern', {
        searchPattern: `%${options.search.trim()}%`,
      });
    }

    if (options?.feed === 'following' && options.followerUserAccountId) {
      qb.andWhere(
        `(
          p.userAccountId = :followerUserAccountId
          OR p.userAccountId IN (
            SELECT target_actor.user_account_id
            FROM actor_connections ac
            INNER JOIN actors my_actor ON my_actor.user_account_id = :followerUserAccountId
            INNER JOIN actors target_actor ON (
              ac.requester_actor_id = my_actor.id AND target_actor.id = ac.receiver_actor_id
            )
            WHERE ac.status = 'ACCEPTED'
          )
        )`,
        { followerUserAccountId: options.followerUserAccountId },
      );
    }

    const [entities, total] = await qb
      .orderBy('p.createdAt', 'DESC')
      .skip(skip)
      .take(take)
      .getManyAndCount();

    const items = await this.hydrateApprovedPostEntities(entities);
    return { items, total };
  }

  private async hydrateApprovedPostEntities(
    entities: ReadonlyArray<Post>,
  ): Promise<ApprovedPostProjection[]> {
    const postIds = entities.map((p) => p.id);
    const mediaMap = new Map<string, string[]>();
    const actorMap = new Map<
      string,
      {
        id: string;
        avatarUrl: string | null;
        firstNames: string | null;
        lastNames: string | null;
        primaryRole: string | null;
      }
    >();

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
          SELECT user_account_id, id, avatar_url, first_names, last_names, primary_role
          FROM actors
          WHERE user_account_id = ANY($1::uuid[])
        `,
        [userAccountIds],
      );
      for (const row of actorRows) {
        actorMap.set(row.user_account_id, {
          id: row.id,
          avatarUrl: row.avatar_url,
          firstNames: row.first_names,
          lastNames: row.last_names,
          primaryRole: row.primary_role,
        });
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

    return entities.map((post) => {
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
        firstNames: actor?.firstNames ?? null,
        lastNames: actor?.lastNames ?? null,
        primaryRole: actor?.primaryRole ?? null,
        localRole: post.userAccount?.localRole ?? null,
        username: post.userAccount?.username ?? null,
        rol: post.userAccount?.rol ?? null,
        nickname: post.device?.nickname ?? null,
        roleTag: post.device?.roleTag ?? null,
      };
    });
  }

  async findApprovedById(postId: string): Promise<ApprovedPostProjection | null> {
    const entity = await this.repository
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
        'ua.localRole',
      ])
      .where('p.id = :postId AND p.status = :approvedStatus', {
        postId,
        approvedStatus: ModerationStatus.APPROVED,
      })
      .getOne();

    if (!entity) {
      return null;
    }

    const hydrated = await this.hydrateApprovedPostEntities([entity]);
    return hydrated[0] ?? null;
  }

  async findById(postId: string): Promise<Post | null> {
    return this.repository.findOne({ where: { id: postId } });
  }

  async updatePost(postId: string, data: UpdatePostData): Promise<Post | null> {
    return this.dataSource.transaction(async (manager) => {
      const postRepo = manager.getRepository(Post);
      const mediaRepo = manager.getRepository(PostMedia);

      const existing = await postRepo.findOne({ where: { id: postId } });
      if (!existing) {
        return null;
      }

      if (data.content !== undefined) {
        existing.content = data.content;
      }
      if (data.imageUrl !== undefined) {
        existing.imageUrl = data.imageUrl;
      }
      existing.status = data.status;
      existing.rejectionReason = data.rejectionReason;

      const saved = await postRepo.save(existing);

      if (data.mediaUrls !== undefined) {
        await mediaRepo.delete({ postId: saved.id });
        if (data.mediaUrls.length > 0) {
          const mediaEntities = data.mediaUrls.map((url, idx) =>
            mediaRepo.create({
              postId: saved.id,
              mediaUrl: url,
              displayOrder: idx,
            }),
          );
          await mediaRepo.save(mediaEntities);
        }
      }

      return saved;
    });
  }

  async deleteById(postId: string): Promise<boolean> {
    const result = await this.repository.delete({ id: postId });
    return (result.affected ?? 0) > 0;
  }

  async findMySubmissionsPaginated(
    userAccountId: string,
    status: ModerationStatus | undefined,
    skip: number,
    take: number,
  ): Promise<{ items: MyPostSubmissionProjection[]; total: number }> {
    const qb = this.repository
      .createQueryBuilder('p')
      .where('p.userAccountId = :userAccountId', { userAccountId });

    if (status) {
      qb.andWhere('p.status = :status', { status });
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

    const items: MyPostSubmissionProjection[] = entities.map((post) => {
      const mediaList = mediaMap.get(post.id) ?? (post.imageUrl ? [post.imageUrl] : []);
      return {
        id: post.id,
        categoryId: post.categoryId,
        content: post.content,
        imageUrl: post.imageUrl ?? mediaList[0] ?? null,
        mediaUrls: mediaList,
        status: post.status,
        rejectionReason: post.rejectionReason,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
      };
    });

    return { items, total };
  }

  async findViewerReactionsByPostIds(
    postIds: ReadonlyArray<string>,
    deviceId: string,
    userAccountId?: string | null,
  ): Promise<Map<string, ReactionType[]>> {
    const result = new Map<string, ReactionType[]>();
    if (postIds.length === 0) {
      return result;
    }

    const rows = userAccountId
      ? await this.dataSource.query<Array<{ post_id: string; type: string }>>(
          `
            SELECT DISTINCT post_id, type
            FROM reactions
            WHERE post_id = ANY($1::uuid[])
              AND (device_id = $2::uuid OR user_account_id = $3::uuid)
          `,
          [postIds, deviceId, userAccountId],
        )
      : await this.dataSource.query<Array<{ post_id: string; type: string }>>(
          `
            SELECT post_id, type
            FROM reactions
            WHERE post_id = ANY($1::uuid[]) AND device_id = $2::uuid
          `,
          [postIds, deviceId],
        );

    for (const row of rows) {
      if (isReactionType(row.type)) {
        const list = result.get(row.post_id) ?? [];
        if (!list.includes(row.type)) {
          list.push(row.type);
        }
        result.set(row.post_id, list);
      }
    }

    return result;
  }

  async findBookmarkedPostIds(
    postIds: ReadonlyArray<string>,
    deviceId: string,
    userAccountId?: string | null,
  ): Promise<Set<string>> {
    const result = new Set<string>();
    if (postIds.length === 0) {
      return result;
    }

    const rows = userAccountId
      ? await this.dataSource.query<Array<{ post_id: string }>>(
          `
            SELECT DISTINCT post_id
            FROM post_bookmarks
            WHERE post_id = ANY($1::uuid[])
              AND (device_id = $2::uuid OR user_account_id = $3::uuid)
          `,
          [postIds, deviceId, userAccountId],
        )
      : await this.dataSource.query<Array<{ post_id: string }>>(
          `
            SELECT post_id
            FROM post_bookmarks
            WHERE post_id = ANY($1::uuid[]) AND device_id = $2::uuid
          `,
          [postIds, deviceId],
        );

    for (const row of rows) {
      result.add(row.post_id);
    }

    return result;
  }

  async toggleBookmark(
    postId: string,
    deviceId: string,
    userAccountId: string | null,
  ): Promise<boolean> {
    const bookmarkRepo = this.dataSource.getRepository(PostBookmark);
    const existing = userAccountId
      ? await bookmarkRepo.find({
          where: [
            { postId, userAccountId },
            { postId, deviceId },
          ],
        })
      : await bookmarkRepo.find({
          where: { postId, deviceId },
        });

    if (existing.length > 0) {
      await bookmarkRepo.remove(existing);
      return false;
    }

    const created = bookmarkRepo.create({
      postId,
      deviceId,
      userAccountId,
    });
    await bookmarkRepo.save(created);
    return true;
  }

  async findBookmarkedPostsPaginated(
    deviceId: string,
    userAccountId: string | null,
    skip: number,
    take: number,
  ): Promise<{ items: ApprovedPostProjection[]; total: number }> {
    const qb = this.repository
      .createQueryBuilder('p')
      .innerJoin(
        PostBookmark,
        'pb',
        userAccountId
          ? 'pb.post_id = p.id AND (pb.device_id = :deviceId OR pb.user_account_id = :userAccountId)'
          : 'pb.post_id = p.id AND pb.device_id = :deviceId',
        { deviceId, userAccountId },
      )
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
        'ua.localRole',
      ])
      .where('p.status = :approvedStatus', { approvedStatus: ModerationStatus.APPROVED });

    const [entities, total] = await qb
      .orderBy('p.createdAt', 'DESC')
      .skip(skip)
      .take(take)
      .getManyAndCount();

    const items = await this.hydrateApprovedPostEntities(entities);
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
        SELECT c.post_id, COUNT(*)::int AS total
        FROM comments c
        LEFT JOIN comments parent_c ON parent_c.id = c.parent_id
        WHERE c.status = $2::"public"."moderation_status_enum"
          AND c.post_id = ANY($1::uuid[])
          AND (c.parent_id IS NULL OR parent_c.status = $2::"public"."moderation_status_enum")
        GROUP BY c.post_id
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
          ranked.first_names,
          ranked.last_names,
          ranked.primary_role,
          ranked.local_role,
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
            a.first_names,
            a.last_names,
            a.primary_role,
            ua.local_role,
            ua.username,
            ua.rol,
            ds.nickname,
            ds.role_tag,
            ROW_NUMBER() OVER (PARTITION BY c.post_id ORDER BY c.created_at DESC) AS rn
          FROM comments c
          LEFT JOIN comments parent_c ON parent_c.id = c.parent_id
          LEFT JOIN device_sessions ds ON ds.id = c.device_id
          LEFT JOIN user_accounts ua ON ua.id = c.user_account_id
          LEFT JOIN actors a ON a.user_account_id = c.user_account_id
          WHERE c.status = $2::"public"."moderation_status_enum"
            AND c.post_id = ANY($1::uuid[])
            AND (c.parent_id IS NULL OR parent_c.status = $2::"public"."moderation_status_enum")
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
        firstNames: row.first_names,
        lastNames: row.last_names,
        primaryRole: row.primary_role,
        localRole: row.local_role,
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
        status: data.status ?? ModerationStatus.APPROVED,
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
             a.id AS actor_id,
             COALESCE(NULLIF(TRIM(CONCAT(a.first_names, ' ', a.last_names)), ''), ua.username, ds.nickname, 'Alguien') AS actor_name,
             a.avatar_url AS actor_avatar_url,
             p.id AS post_id,
             NULL::uuid AS comment_id,
             NULL::uuid AS connection_id,
             NULL::varchar AS connection_status,
             cat.name AS category_name,
             SUBSTRING(p.content FROM 1 FOR 120) AS snippet,
             r.created_at
      FROM reactions r
      INNER JOIN posts p ON p.id = r.post_id
      LEFT JOIN categories cat ON cat.id = p.category_id
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
             a.id AS actor_id,
             COALESCE(NULLIF(TRIM(CONCAT(a.first_names, ' ', a.last_names)), ''), ua.username, ds.nickname, 'Alguien') AS actor_name,
             a.avatar_url AS actor_avatar_url,
             p.id AS post_id,
             c.id AS comment_id,
             NULL::uuid AS connection_id,
             NULL::varchar AS connection_status,
             cat.name AS category_name,
             SUBSTRING(c.content FROM 1 FOR 120) AS snippet,
             c.created_at
      FROM comments c
      INNER JOIN posts p ON p.id = c.post_id
      LEFT JOIN categories cat ON cat.id = p.category_id
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
             a.id AS actor_id,
             COALESCE(NULLIF(TRIM(CONCAT(a.first_names, ' ', a.last_names)), ''), ua.username, ds.nickname, 'Alguien') AS actor_name,
             a.avatar_url AS actor_avatar_url,
             c.post_id AS post_id,
             c.id AS comment_id,
             NULL::uuid AS connection_id,
             NULL::varchar AS connection_status,
             cat.name AS category_name,
             SUBSTRING(c.content FROM 1 FOR 120) AS snippet,
             c.created_at
      FROM comments c
      INNER JOIN comments parent ON parent.id = c.parent_id
      INNER JOIN posts p ON p.id = c.post_id
      LEFT JOIN categories cat ON cat.id = p.category_id
      LEFT JOIN user_accounts ua ON ua.id = c.user_account_id
      LEFT JOIN actors a ON a.user_account_id = ua.id
      LEFT JOIN device_sessions ds ON ds.id = c.device_id
      WHERE parent.user_account_id = $1
        AND (c.user_account_id IS NULL OR c.user_account_id != $1)
        AND (c.device_id != $2)
        AND c.status = 'APPROVED'
        AND c.created_at >= $3

      UNION ALL

      -- 4. Likes on my comments
      SELECT cr.id,
             'LIKE_ON_COMMENT' AS notif_type,
             'Le gustó tu comentario' AS title,
             CONCAT(COALESCE(NULLIF(TRIM(CONCAT(a.first_names, ' ', a.last_names)), ''), ua.username, ds.nickname, 'Alguien'), ' reaccionó a tu comentario.') AS body,
             a.id AS actor_id,
             COALESCE(NULLIF(TRIM(CONCAT(a.first_names, ' ', a.last_names)), ''), ua.username, ds.nickname, 'Alguien') AS actor_name,
             a.avatar_url AS actor_avatar_url,
             c.post_id AS post_id,
             c.id AS comment_id,
             NULL::uuid AS connection_id,
             NULL::varchar AS connection_status,
             cat.name AS category_name,
             SUBSTRING(c.content FROM 1 FOR 120) AS snippet,
             cr.created_at
      FROM comment_reactions cr
      INNER JOIN comments c ON c.id = cr.comment_id
      INNER JOIN posts p ON p.id = c.post_id
      LEFT JOIN categories cat ON cat.id = p.category_id
      LEFT JOIN user_accounts ua ON ua.id = cr.user_account_id
      LEFT JOIN actors a ON a.user_account_id = ua.id
      LEFT JOIN device_sessions ds ON ds.id = cr.device_id
      WHERE c.user_account_id = $1
        AND (cr.user_account_id IS NULL OR cr.user_account_id != $1)
        AND (cr.device_id != $2)
        AND cr.created_at >= $3

      UNION ALL

      -- 5. Follower connections on my profile
      SELECT ac.id,
             'NEW_FOLLOWER' AS notif_type,
             CASE
               WHEN ac.status = 'PENDING' THEN 'Solicitud para seguirte'
               ELSE 'Nueva conexión en tu perfil'
             END AS title,
             CONCAT(
               COALESCE(NULLIF(TRIM(CONCAT(a.first_names, ' ', a.last_names)), ''), ua.username, 'Alguien'),
               CASE
                 WHEN ac.status = 'PENDING' THEN ' solicitó seguirte.'
                 ELSE ' comenzó a seguirte.'
               END
             ) AS body,
             a.id AS actor_id,
             COALESCE(NULLIF(TRIM(CONCAT(a.first_names, ' ', a.last_names)), ''), ua.username, 'Alguien') AS actor_name,
             a.avatar_url AS actor_avatar_url,
             NULL::uuid AS post_id,
             NULL::uuid AS comment_id,
             ac.id AS connection_id,
             ac.status AS connection_status,
             NULL::varchar AS category_name,
             SUBSTRING(a.short_bio FROM 1 FOR 120) AS snippet,
             ac.requested_at AS created_at
      FROM actor_connections ac
      INNER JOIN actors my_actor ON my_actor.id = ac.receiver_actor_id
      INNER JOIN actors a ON a.id = ac.requester_actor_id
      LEFT JOIN user_accounts ua ON ua.id = a.user_account_id
      WHERE my_actor.user_account_id = $1
        AND ac.status IN ('PENDING', 'ACCEPTED')
        AND ac.requested_at >= $3

      UNION ALL

      -- 6. Foundation announcements
      SELECT p.id,
             'FOUNDATION_ANNOUNCEMENT' AS notif_type,
             'Aviso oficial de ASISCO UP' AS title,
             SUBSTRING(p.content FROM 1 FOR 100) AS body,
             a.id AS actor_id,
             'Fundación ASISCO UP' AS actor_name,
             a.avatar_url AS actor_avatar_url,
             p.id AS post_id,
             NULL::uuid AS comment_id,
             NULL::uuid AS connection_id,
             NULL::varchar AS connection_status,
             cat.name AS category_name,
             SUBSTRING(p.content FROM 1 FOR 120) AS snippet,
             p.created_at
      FROM posts p
      INNER JOIN categories cat ON cat.id = p.category_id
      LEFT JOIN actors a ON a.user_account_id = p.user_account_id
      WHERE (cat.name ILIKE '%noticia%' OR cat.name ILIKE '%aviso%' OR cat.main_topic ILIKE '%institucional%')
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
