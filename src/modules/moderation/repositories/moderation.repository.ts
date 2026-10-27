import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { ModerationStatus } from '../../../common/enums/moderation-status.enum';
import type { ModerationItemType } from '../dto/pending-query.dto';
import type { AllowedModerationDecision } from '../dto/update-moderation-status.dto';
import type {
  IModerationRepository,
  ModerationUpdatedRecord,
  ModeratorAccountRecord,
  PendingModerationRow,
} from '../interfaces/i-moderation.repository';

interface RawPendingRow {
  readonly id: string;
  readonly item_type: 'POST' | 'COMMENT';
  readonly post_id: string | null;
  readonly category_id: string | null;
  readonly content: string;
  readonly image_url: string | null;
  readonly device_id: string;
  readonly user_account_id: string | null;
  readonly username: string | null;
  readonly rol: string | null;
  readonly nickname: string | null;
  readonly role_tag: string | null;
  readonly created_at: Date | string;
}

interface RawCountRow {
  readonly total: number | string;
}

interface RawUpdatedRow {
  readonly id: string;
  readonly status: AllowedModerationDecision;
  readonly rejection_reason: string | null;
  readonly updated_at: Date | string;
}

interface RawModeratorRow {
  readonly id: string;
  readonly username: string;
  readonly email: string;
  readonly rol: string;
  readonly local_role: string | null;
}

function mapRawPendingRow(row: RawPendingRow): PendingModerationRow {
  return {
    id: row.id,
    itemType: row.item_type,
    postId: row.post_id,
    categoryId: row.category_id,
    content: row.content,
    imageUrl: row.image_url,
    deviceId: row.device_id,
    userAccountId: row.user_account_id,
    username: row.username,
    rol: row.rol,
    nickname: row.nickname,
    roleTag: row.role_tag,
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
  };
}

@Injectable()
export class ModerationRepository implements IModerationRepository {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async findPending(
    type: ModerationItemType | undefined,
    skip: number,
    take: number,
  ): Promise<{ items: PendingModerationRow[]; total: number }> {
    const pendingStatus = ModerationStatus.PENDING;

    if (type === 'POST') {
      const [rows, countRows] = await Promise.all([
        this.dataSource.query<RawPendingRow[]>(
          `
            SELECT
              p.id,
              'POST'::text AS item_type,
              NULL::uuid AS post_id,
              p.category_id,
              p.content,
              p.image_url,
              p.device_id,
              p.user_account_id,
              ua.username,
              ua.rol,
              ds.nickname,
              ds.role_tag,
              p.created_at
            FROM posts p
            LEFT JOIN device_sessions ds ON ds.id = p.device_id
            LEFT JOIN user_accounts ua ON ua.id = p.user_account_id
            WHERE p.status = $1::"public"."moderation_status_enum"
            ORDER BY p.created_at ASC
            LIMIT $2 OFFSET $3
          `,
          [pendingStatus, take, skip],
        ),
        this.dataSource.query<RawCountRow[]>(
          `SELECT COUNT(*)::int AS total FROM posts WHERE status = $1::"public"."moderation_status_enum"`,
          [pendingStatus],
        ),
      ]);

      return {
        items: rows.map(mapRawPendingRow),
        total: Number(countRows[0]?.total ?? 0),
      };
    }

    if (type === 'COMMENT') {
      const [rows, countRows] = await Promise.all([
        this.dataSource.query<RawPendingRow[]>(
          `
            SELECT
              c.id,
              'COMMENT'::text AS item_type,
              c.post_id,
              NULL::uuid AS category_id,
              c.content,
              NULL::varchar AS image_url,
              c.device_id,
              c.user_account_id,
              ua.username,
              ua.rol,
              ds.nickname,
              ds.role_tag,
              c.created_at
            FROM comments c
            LEFT JOIN device_sessions ds ON ds.id = c.device_id
            LEFT JOIN user_accounts ua ON ua.id = c.user_account_id
            WHERE c.status = $1::"public"."moderation_status_enum"
            ORDER BY c.created_at ASC
            LIMIT $2 OFFSET $3
          `,
          [pendingStatus, take, skip],
        ),
        this.dataSource.query<RawCountRow[]>(
          `SELECT COUNT(*)::int AS total FROM comments WHERE status = $1::"public"."moderation_status_enum"`,
          [pendingStatus],
        ),
      ]);

      return {
        items: rows.map(mapRawPendingRow),
        total: Number(countRows[0]?.total ?? 0),
      };
    }

    const [rows, countRows] = await Promise.all([
      this.dataSource.query<RawPendingRow[]>(
        `
          SELECT * FROM (
            SELECT
              p.id,
              'POST'::text AS item_type,
              NULL::uuid AS post_id,
              p.category_id,
              p.content,
              p.image_url,
              p.device_id,
              p.user_account_id,
              ua.username,
              ua.rol,
              ds.nickname,
              ds.role_tag,
              p.created_at
            FROM posts p
            LEFT JOIN device_sessions ds ON ds.id = p.device_id
            LEFT JOIN user_accounts ua ON ua.id = p.user_account_id
            WHERE p.status = $1::"public"."moderation_status_enum"

            UNION ALL

            SELECT
              c.id,
              'COMMENT'::text AS item_type,
              c.post_id,
              NULL::uuid AS category_id,
              c.content,
              NULL::varchar AS image_url,
              c.device_id,
              c.user_account_id,
              ua.username,
              ua.rol,
              ds.nickname,
              ds.role_tag,
              c.created_at
            FROM comments c
            LEFT JOIN device_sessions ds ON ds.id = c.device_id
            LEFT JOIN user_accounts ua ON ua.id = c.user_account_id
            WHERE c.status = $1::"public"."moderation_status_enum"
          ) AS combined
          ORDER BY combined.created_at ASC
          LIMIT $2 OFFSET $3
        `,
        [pendingStatus, take, skip],
      ),
      this.dataSource.query<RawCountRow[]>(
        `
          SELECT (
            (SELECT COUNT(*)::int FROM posts WHERE status = $1::"public"."moderation_status_enum") +
            (SELECT COUNT(*)::int FROM comments WHERE status = $1::"public"."moderation_status_enum")
          ) AS total
        `,
        [pendingStatus],
      ),
    ]);

    return {
      items: rows.map(mapRawPendingRow),
      total: Number(countRows[0]?.total ?? 0),
    };
  }

  async updatePostStatus(
    id: string,
    status: AllowedModerationDecision,
  ): Promise<ModerationUpdatedRecord | null> {
    const rejectionReason = status === ModerationStatus.REJECTED ? 'HUMAN' : null;
    const rows = await this.dataSource.query<RawUpdatedRow[]>(
      `
        WITH updated AS (
          UPDATE posts
          SET
            status = $1::"public"."moderation_status_enum",
            rejection_reason = $3,
            updated_at = now()
          WHERE id = $2
          RETURNING id, status, rejection_reason, updated_at
        )
        SELECT id, status, rejection_reason, updated_at FROM updated
      `,
      [status, id, rejectionReason],
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      itemType: 'POST',
      status: row.status,
      rejectionReason: row.rejection_reason,
      updatedAt: row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at),
    };
  }

  async updateCommentStatus(
    id: string,
    status: AllowedModerationDecision,
  ): Promise<ModerationUpdatedRecord | null> {
    const rejectionReason = status === ModerationStatus.REJECTED ? 'HUMAN' : null;
    const rows = await this.dataSource.query<RawUpdatedRow[]>(
      `
        WITH updated AS (
          UPDATE comments
          SET
            status = $1::"public"."moderation_status_enum",
            rejection_reason = $3
          WHERE id = $2
          RETURNING id, status, rejection_reason, now() AS updated_at
        )
        SELECT id, status, rejection_reason, updated_at FROM updated
      `,
      [status, id, rejectionReason],
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      itemType: 'COMMENT',
      status: row.status,
      rejectionReason: row.rejection_reason,
      updatedAt: row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at),
    };
  }

  async listModerators(): Promise<ModeratorAccountRecord[]> {
    const rows = await this.dataSource.query<RawModeratorRow[]>(
      `
        SELECT id, username, email, rol, local_role
        FROM user_accounts
        WHERE local_role = 'MODERATOR' AND is_active = true
        ORDER BY username ASC
      `,
    );

    return rows.map((r) => ({
      id: r.id,
      username: r.username,
      email: r.email,
      rol: r.rol,
      localRole: r.local_role,
    }));
  }

  async setLocalRole(
    userAccountId: string,
    localRole: 'MODERATOR' | null,
  ): Promise<ModeratorAccountRecord | null> {
    const rows = await this.dataSource.query<RawModeratorRow[]>(
      `
        UPDATE user_accounts
        SET local_role = $2
        WHERE id = $1
        RETURNING id, username, email, rol, local_role
      `,
      [userAccountId, localRole],
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      username: row.username,
      email: row.email,
      rol: row.rol,
      localRole: row.local_role,
    };
  }
}
