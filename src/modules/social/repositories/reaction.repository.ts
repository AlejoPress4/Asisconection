import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { type DataSource, QueryFailedError } from 'typeorm';
import type { ReactionType } from '../../../common/enums/reaction-type.enum';
import { CommentReaction } from '../entities/comment-reaction.entity';
import { Reaction } from '../entities/reaction.entity';
import type { IReactionRepository } from '../interfaces/i-reaction.repository';

function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }
  const driverError = error.driverError as { readonly code?: string } | undefined;
  return driverError?.code === '23505';
}

@Injectable()
export class ReactionRepository implements IReactionRepository {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async toggle(
    postId: string,
    deviceId: string,
    userAccountId: string | null,
    type: ReactionType,
  ): Promise<boolean> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const repo = manager.getRepository(Reaction);
        const existing = userAccountId
          ? await repo.find({
              where: [
                { postId, userAccountId, type },
                { postId, deviceId, type },
              ],
              select: { id: true },
            })
          : await repo.find({
              where: { postId, deviceId, type },
              select: { id: true },
            });

        if (existing.length > 0) {
          await repo.delete(existing.map((item) => item.id));
          return false;
        }

        const created = repo.create({
          postId,
          deviceId,
          userAccountId,
          type,
        });
        await repo.save(created);
        return true;
      });
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        return true;
      }
      throw error;
    }
  }

  async toggleCommentReaction(
    commentId: string,
    deviceId: string,
    userAccountId: string | null,
    type: ReactionType,
  ): Promise<boolean> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const repo = manager.getRepository(CommentReaction);
        const existing = userAccountId
          ? await repo.find({
              where: [
                { commentId, userAccountId, type },
                { commentId, deviceId, type },
              ],
              select: { id: true },
            })
          : await repo.find({
              where: { commentId, deviceId, type },
              select: { id: true },
            });

        if (existing.length > 0) {
          await repo.delete(existing.map((item) => item.id));
          return false;
        }

        const created = repo.create({
          commentId,
          deviceId,
          userAccountId,
          type,
        });
        await repo.save(created);
        return true;
      });
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        return true;
      }
      throw error;
    }
  }
}
