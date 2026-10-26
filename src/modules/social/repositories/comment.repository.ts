import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { ModerationStatus } from '../../../common/enums/moderation-status.enum';
import { Comment } from '../entities/comment.entity';
import type { CreateCommentData, ICommentRepository } from '../interfaces/i-comment.repository';

@Injectable()
export class CommentRepository implements ICommentRepository {
  constructor(
    @InjectRepository(Comment)
    private readonly repository: Repository<Comment>,
  ) {}

  async create(data: CreateCommentData): Promise<Comment> {
    const entity = this.repository.create({
      postId: data.postId,
      deviceId: data.deviceId,
      userAccountId: data.userAccountId,
      content: data.content,
      status: ModerationStatus.PENDING,
    });
    return this.repository.save(entity);
  }
}
