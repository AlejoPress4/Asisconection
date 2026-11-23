import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import type { DataSource, Repository } from 'typeorm';
import { ModerationStatus } from '../../../common/enums/moderation-status.enum';
import { Comment } from '../entities/comment.entity';
import type { CreateCommentData, ICommentRepository } from '../interfaces/i-comment.repository';
import type { ApprovedCommentProjection } from '../interfaces/i-post.repository';

interface RawApprovedCommentRow {
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
  readonly likes_count: number | string;
  readonly liked_by_me?: boolean;
}

interface RawCountRow {
  readonly total: number | string;
}

@Injectable()
export class CommentRepository implements ICommentRepository {
  constructor(
    @InjectRepository(Comment)
    private readonly repository: Repository<Comment>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async create(data: CreateCommentData): Promise<Comment> {
    const entity = this.repository.create({
      postId: data.postId,
      parentId: data.parentId ?? null,
      deviceId: data.deviceId,
      userAccountId: data.userAccountId,
      content: data.content,
      status: data.status ?? ModerationStatus.APPROVED,
      rejectionReason: data.rejectionReason ?? null,
    });
    return this.repository.save(entity);
  }

  async findById(id: string): Promise<Comment | null> {
    return this.repository.findOne({ where: { id } });
  }

  async deleteById(id: string): Promise<boolean> {
    await this.repository.delete({ parentId: id });
    const result = await this.repository.delete({ id });
    return (result.affected ?? 0) > 0;
  }

  async findApprovedByPostId(
    postId: string,
    skip: number,
    take: number,
    viewerDeviceId?: string,
    viewerUserAccountId?: string | null,
  ): Promise<{ items: ApprovedCommentProjection[]; total: number }> {
    const [rows, countRows] = await Promise.all([
      this.dataSource.query<RawApprovedCommentRow[]>(
        `
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
            COALESCE(cr.likes_count, 0)::int AS likes_count,
            CASE
              WHEN $5::uuid IS NOT NULL THEN EXISTS (
                SELECT 1
                FROM comment_reactions my_cr
                WHERE my_cr.comment_id = c.id
                  AND (
                    my_cr.device_id = $5::uuid
                    OR ($6::uuid IS NOT NULL AND my_cr.user_account_id = $6::uuid)
                  )
              )
              ELSE false
            END AS liked_by_me
          FROM comments c
          LEFT JOIN comments parent_c ON parent_c.id = c.parent_id
          LEFT JOIN device_sessions ds ON ds.id = c.device_id
          LEFT JOIN user_accounts ua ON ua.id = c.user_account_id
          LEFT JOIN actors a ON a.user_account_id = c.user_account_id
          LEFT JOIN (
            SELECT comment_id, COUNT(*)::int AS likes_count
            FROM comment_reactions
            GROUP BY comment_id
          ) cr ON cr.comment_id = c.id
          WHERE c.post_id = $1::uuid
            AND c.status = $2::"public"."moderation_status_enum"
            AND (c.parent_id IS NULL OR parent_c.status = $2::"public"."moderation_status_enum")
          ORDER BY c.created_at ASC
          OFFSET $3
          LIMIT $4
        `,
        [
          postId,
          ModerationStatus.APPROVED,
          skip,
          take,
          viewerDeviceId ?? null,
          viewerUserAccountId ?? null,
        ],
      ),
      this.dataSource.query<RawCountRow[]>(
        `
          SELECT COUNT(*)::int AS total
          FROM comments c
          LEFT JOIN comments parent_c ON parent_c.id = c.parent_id
          WHERE c.post_id = $1::uuid
            AND c.status = $2::"public"."moderation_status_enum"
            AND (c.parent_id IS NULL OR parent_c.status = $2::"public"."moderation_status_enum")
        `,
        [postId, ModerationStatus.APPROVED],
      ),
    ]);

    const items: ApprovedCommentProjection[] = rows.map((row) => ({
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
      likesCount: Number(row.likes_count ?? 0),
      likedByMe: Boolean(row.liked_by_me),
    }));

    return {
      items,
      total: Number(countRows[0]?.total ?? 0),
    };
  }

  async countCommentsByDeviceSince(deviceId: string, since: Date): Promise<number> {
    return this.repository
      .createQueryBuilder('c')
      .where('c.device_id = :deviceId AND c.created_at >= :since', { deviceId, since })
      .getCount();
  }
}
