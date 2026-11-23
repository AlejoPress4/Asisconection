import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { ModerationStatus } from '../../../common/enums/moderation-status.enum';
import type {
  ContentReportReason,
  ContentReportStatus,
  ContentReportTargetType,
} from '../dto/content-report.dto';
import type { ModerationItemType } from '../dto/pending-query.dto';
import type { AllowedModerationDecision } from '../dto/update-moderation-status.dto';
import type {
  ContentReportRecord,
  CreateContentReportInput,
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
  readonly display_name?: string | null;
  readonly avatar_url?: string | null;
}

interface RawContentReportRow {
  readonly id: string;
  readonly target_type: ContentReportTargetType;
  readonly post_id: string | null;
  readonly comment_id: string | null;
  readonly target_content_preview?: string | null;
  readonly reason: ContentReportReason;
  readonly details: string | null;
  readonly status: ContentReportStatus;
  readonly reporter_device_id: string;
  readonly reporter_user_account_id: string | null;
  readonly resolved_by_user_account_id: string | null;
  readonly resolved_at: Date | string | null;
  readonly created_at: Date | string;
}

function mapRawContentReportRow(row: RawContentReportRow): ContentReportRecord {
  return {
    id: row.id,
    targetType: row.target_type,
    targetId: (row.target_type === 'POST' ? row.post_id : row.comment_id) ?? '',
    targetContentPreview: row.target_content_preview ?? null,
    reason: row.reason,
    details: row.details,
    status: row.status,
    reporterDeviceId: row.reporter_device_id,
    reporterUserAccountId: row.reporter_user_account_id,
    resolvedByUserAccountId: row.resolved_by_user_account_id,
    resolvedAt:
      row.resolved_at === null
        ? null
        : row.resolved_at instanceof Date
          ? row.resolved_at
          : new Date(row.resolved_at),
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
  };
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
export class ModerationRepository implements IModerationRepository, OnModuleInit {
  private readonly logger = new Logger(ModerationRepository.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS "content_reports" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "target_type" varchar(20) NOT NULL,
          "post_id" uuid NULL,
          "comment_id" uuid NULL,
          "reporter_device_id" uuid NOT NULL,
          "reporter_user_account_id" uuid NULL,
          "reason" varchar(40) NOT NULL,
          "details" varchar(500) NULL,
          "status" varchar(20) NOT NULL DEFAULT 'OPEN',
          "resolved_by_user_account_id" uuid NULL,
          "resolved_at" TIMESTAMPTZ NULL,
          "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT "PK_content_reports_id" PRIMARY KEY ("id"),
          CONSTRAINT "FK_content_reports_post" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE,
          CONSTRAINT "FK_content_reports_comment" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE,
          CONSTRAINT "FK_content_reports_reporter_device" FOREIGN KEY ("reporter_device_id") REFERENCES "device_sessions"("id") ON DELETE CASCADE,
          CONSTRAINT "FK_content_reports_reporter_user" FOREIGN KEY ("reporter_user_account_id") REFERENCES "user_accounts"("id") ON DELETE SET NULL,
          CONSTRAINT "FK_content_reports_resolved_user" FOREIGN KEY ("resolved_by_user_account_id") REFERENCES "user_accounts"("id") ON DELETE SET NULL
        );
      `);
    } catch (error) {
      this.logger.warn(
        `No se pudo asegurar la tabla "content_reports": ${
          error instanceof Error ? error.message : 'error desconocido'
        }`,
      );
    }
  }

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

    if (status === ModerationStatus.REJECTED) {
      await this.dataSource.query(
        `
          UPDATE comments
          SET
            status = $1::"public"."moderation_status_enum",
            rejection_reason = $3
          WHERE parent_id = $2::uuid
        `,
        [status, id, rejectionReason],
      );
    }

    return {
      id: row.id,
      itemType: 'COMMENT',
      status: row.status,
      rejectionReason: row.rejection_reason,
      updatedAt: row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at),
    };
  }

  async listAccounts(search?: string): Promise<ModeratorAccountRecord[]> {
    let query = `
      SELECT ua.id, ua.username, ua.email, ua.rol, ua.local_role,
             COALESCE(NULLIF(TRIM(CONCAT(a.first_names, ' ', a.last_names)), ''), ua.username) AS display_name,
             a.avatar_url
      FROM user_accounts ua
      LEFT JOIN actors a ON a.user_account_id = ua.id
      WHERE ua.is_active = true
    `;
    const params: unknown[] = [];
    if (search && search.trim().length > 0) {
      params.push(`%${search.trim()}%`);
      query += ` AND (ua.username ILIKE $1 OR ua.email ILIKE $1 OR a.first_names ILIKE $1 OR a.last_names ILIKE $1)`;
    }
    query += ` ORDER BY ua.username ASC LIMIT 50`;

    const rows = await this.dataSource.query<RawModeratorRow[]>(query, params);

    return rows.map((r) => ({
      id: r.id,
      username: r.username,
      email: r.email,
      rol: r.rol,
      localRole: r.local_role,
      displayName: r.display_name ?? null,
      avatarUrl: r.avatar_url ?? null,
    }));
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

  async targetExistsAndApproved(
    targetType: ContentReportTargetType,
    targetId: string,
  ): Promise<boolean> {
    if (targetType === 'POST') {
      const rows = await this.dataSource.query<RawCountRow[]>(
        `SELECT COUNT(*)::int AS total FROM posts WHERE id = $1::uuid AND status = $2::"public"."moderation_status_enum"`,
        [targetId, ModerationStatus.APPROVED],
      );
      return Number(rows[0]?.total ?? 0) > 0;
    }

    const rows = await this.dataSource.query<RawCountRow[]>(
      `SELECT COUNT(*)::int AS total FROM comments WHERE id = $1::uuid AND status = $2::"public"."moderation_status_enum"`,
      [targetId, ModerationStatus.APPROVED],
    );
    return Number(rows[0]?.total ?? 0) > 0;
  }

  async hasOpenReportByDevice(
    targetType: ContentReportTargetType,
    targetId: string,
    reporterDeviceId: string,
  ): Promise<boolean> {
    const column = targetType === 'POST' ? 'post_id' : 'comment_id';
    const rows = await this.dataSource.query<RawCountRow[]>(
      `
        SELECT COUNT(*)::int AS total
        FROM content_reports
        WHERE target_type = $1
          AND ${column} = $2::uuid
          AND reporter_device_id = $3::uuid
          AND status = 'OPEN'
      `,
      [targetType, targetId, reporterDeviceId],
    );
    return Number(rows[0]?.total ?? 0) > 0;
  }

  async createContentReport(input: CreateContentReportInput): Promise<ContentReportRecord> {
    const postId = input.targetType === 'POST' ? input.targetId : null;
    const commentId = input.targetType === 'COMMENT' ? input.targetId : null;
    const rows = await this.dataSource.query<RawContentReportRow[]>(
      `
        INSERT INTO content_reports (
          target_type,
          post_id,
          comment_id,
          reporter_device_id,
          reporter_user_account_id,
          reason,
          details,
          status
        )
        VALUES ($1, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6, $7, 'OPEN')
        RETURNING *
      `,
      [
        input.targetType,
        postId,
        commentId,
        input.reporterDeviceId,
        input.reporterUserAccountId,
        input.reason,
        input.details,
      ],
    );

    return mapRawContentReportRow(rows[0]!);
  }

  async findContentReports(
    status: ContentReportStatus | undefined,
    skip: number,
    take: number,
  ): Promise<{ items: ContentReportRecord[]; total: number }> {
    const params: unknown[] = [];
    let whereClause = '';
    if (status) {
      params.push(status);
      whereClause = `WHERE cr.status = $1`;
    }

    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;

    const [rows, countRows] = await Promise.all([
      this.dataSource.query<RawContentReportRow[]>(
        `
          SELECT
            cr.*,
            SUBSTRING(COALESCE(p.content, c.content) FROM 1 FOR 140) AS target_content_preview
          FROM content_reports cr
          LEFT JOIN posts p ON p.id = cr.post_id
          LEFT JOIN comments c ON c.id = cr.comment_id
          ${whereClause}
          ORDER BY cr.created_at DESC
          LIMIT $${limitIdx} OFFSET $${offsetIdx}
        `,
        [...params, take, skip],
      ),
      this.dataSource.query<RawCountRow[]>(
        `SELECT COUNT(*)::int AS total FROM content_reports cr ${whereClause}`,
        params,
      ),
    ]);

    return {
      items: rows.map(mapRawContentReportRow),
      total: Number(countRows[0]?.total ?? 0),
    };
  }

  async resolveContentReport(
    reportId: string,
    status: 'RESOLVED' | 'DISMISSED',
    resolvedByUserAccountId: string | null,
  ): Promise<ContentReportRecord | null> {
    const rows = await this.dataSource.query<RawContentReportRow[]>(
      `
        UPDATE content_reports
        SET
          status = $2,
          resolved_by_user_account_id = $3::uuid,
          resolved_at = now()
        WHERE id = $1::uuid
        RETURNING *
      `,
      [reportId, status, resolvedByUserAccountId],
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    return mapRawContentReportRow(row);
  }
}
