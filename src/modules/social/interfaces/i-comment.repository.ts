import type { ModerationStatus } from '../../../common/enums/moderation-status.enum';
import type { Comment } from '../entities/comment.entity';

export interface CreateCommentData {
  readonly postId: string;
  readonly parentId?: string | null;
  readonly deviceId: string;
  readonly userAccountId: string | null;
  readonly content: string;
  readonly status?: ModerationStatus;
  readonly rejectionReason?: string | null;
}

export interface ICommentRepository {
  create(data: CreateCommentData): Promise<Comment>;
  findById?(id: string): Promise<Comment | null>;
  countCommentsByDeviceSince?(deviceId: string, since: Date): Promise<number>;
}

export const COMMENT_REPOSITORY = Symbol('COMMENT_REPOSITORY');
