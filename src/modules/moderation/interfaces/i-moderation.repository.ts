import type {
  ContentReportReason,
  ContentReportStatus,
  ContentReportTargetType,
} from '../dto/content-report.dto';
import type { ModerationItemType } from '../dto/pending-query.dto';
import type { AllowedModerationDecision } from '../dto/update-moderation-status.dto';

export interface PendingModerationRow {
  readonly id: string;
  readonly itemType: ModerationItemType;
  readonly postId: string | null;
  readonly categoryId: string | null;
  readonly content: string;
  readonly imageUrl: string | null;
  readonly deviceId: string;
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
  readonly createdAt: Date;
}

export interface ModerationUpdatedRecord {
  readonly id: string;
  readonly itemType: ModerationItemType;
  readonly status: AllowedModerationDecision;
  readonly rejectionReason?: string | null;
  readonly updatedAt: Date;
}

export interface ModeratorAccountRecord {
  readonly id: string;
  readonly actorId?: string | null;
  readonly username: string;
  readonly email: string;
  readonly rol: string;
  readonly localRole: string | null;
  readonly displayName?: string | null;
  readonly avatarUrl?: string | null;
  readonly isActive?: boolean;
}

export interface CreateContentReportInput {
  readonly targetType: ContentReportTargetType;
  readonly targetId: string;
  readonly reporterDeviceId: string;
  readonly reporterUserAccountId: string | null;
  readonly reason: ContentReportReason;
  readonly details: string | null;
}

export interface ContentReportRecord {
  readonly id: string;
  readonly targetType: ContentReportTargetType;
  readonly targetId: string;
  readonly targetContentPreview?: string | null;
  readonly reason: ContentReportReason;
  readonly details: string | null;
  readonly status: ContentReportStatus;
  readonly reporterDeviceId: string;
  readonly reporterUserAccountId: string | null;
  readonly resolvedByUserAccountId: string | null;
  readonly resolvedAt: Date | null;
  readonly createdAt: Date;
}

export interface IModerationRepository {
  findPending(
    type: ModerationItemType | undefined,
    skip: number,
    take: number,
  ): Promise<{ items: PendingModerationRow[]; total: number }>;
  updatePostStatus(
    id: string,
    status: AllowedModerationDecision,
  ): Promise<ModerationUpdatedRecord | null>;
  updateCommentStatus(
    id: string,
    status: AllowedModerationDecision,
  ): Promise<ModerationUpdatedRecord | null>;
  listModerators?(): Promise<ModeratorAccountRecord[]>;
  listAccounts?(search?: string, includeInactive?: boolean): Promise<ModeratorAccountRecord[]>;
  setLocalRole?(
    userAccountId: string,
    localRole: 'MODERATOR' | null,
  ): Promise<ModeratorAccountRecord | null>;
  setAccountActiveStatus?(
    userAccountId: string,
    isActive: boolean,
  ): Promise<ModeratorAccountRecord | null>;
  targetExistsAndApproved?(targetType: ContentReportTargetType, targetId: string): Promise<boolean>;
  hasOpenReportByDevice?(
    targetType: ContentReportTargetType,
    targetId: string,
    reporterDeviceId: string,
    reporterUserAccountId?: string | null,
  ): Promise<boolean>;
  createContentReport?(input: CreateContentReportInput): Promise<ContentReportRecord>;
  findContentReports?(
    status: ContentReportStatus | undefined,
    skip: number,
    take: number,
  ): Promise<{ items: ContentReportRecord[]; total: number }>;
  resolveContentReport?(
    reportId: string,
    status: 'RESOLVED' | 'DISMISSED',
    resolvedByUserAccountId: string | null,
  ): Promise<ContentReportRecord | null>;
  resolveOtherOpenReportsForTarget?(
    targetType: ContentReportTargetType,
    targetId: string,
    excludeReportId: string,
    resolvedByUserAccountId: string | null,
  ): Promise<void>;
}

export const MODERATION_REPOSITORY = Symbol('MODERATION_REPOSITORY');
