import type { Comment } from '../entities/comment.entity';

export interface CreateCommentData {
  readonly postId: string;
  readonly deviceId: string;
  readonly userAccountId: string | null;
  readonly content: string;
}

export interface ICommentRepository {
  create(data: CreateCommentData): Promise<Comment>;
}

export const COMMENT_REPOSITORY = Symbol('COMMENT_REPOSITORY');
