import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { type DataSource, QueryFailedError } from 'typeorm';
import type { ReactionType } from '../../../common/enums/reaction-type.enum';
import { CommentReaction } from '../entities/comment-reaction.entity';
import { Reaction } from '../entities/reaction.entity';
import type { IReactionRepository } from '../interfaces/i-reaction.repository';

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as { readonly code?: string } | undefined)?.code === '23505'
  );
}

/**
 * Repositorio de reacciones alternables (`toggle`) para publicaciones (`Reaction`)
 * y comentarios (`CommentReaction`), libre de condiciones de carrera.
 */
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
        const existing = await repo.findOne({
          where: { postId, deviceId, type },
          select: { id: true },
        });
        if (existing) {
          await repo.delete({ id: existing.id });
          return false;
        }
        await repo.save(repo.create({ postId, deviceId, userAccountId, type }));
        return true;
      });
    } catch (error: unknown) {
      if (isUniqueViolation(error)) return true;
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
        const existing = await repo.findOne({
          where: { commentId, deviceId, type },
          select: { id: true },
        });
        if (existing) {
          await repo.delete({ id: existing.id });
          return false;
        }
        await repo.save(repo.create({ commentId, deviceId, userAccountId, type }));
        return true;
      });
    } catch (error: unknown) {
      if (isUniqueViolation(error)) return true;
      throw error;
    }
  }
}
