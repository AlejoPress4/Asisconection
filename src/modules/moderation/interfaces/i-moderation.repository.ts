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
  readonly username: string;
  readonly email: string;
  readonly rol: string;
  readonly localRole: string | null;
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
  setLocalRole?(userAccountId: string, localRole: 'MODERATOR' | null): Promise<ModeratorAccountRecord | null>;
}

export const MODERATION_REPOSITORY = Symbol('MODERATION_REPOSITORY');
