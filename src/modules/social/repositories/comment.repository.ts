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
      parentId: data.parentId ?? null,
      deviceId: data.deviceId,
      userAccountId: data.userAccountId,
      content: data.content,
      status: data.status ?? ModerationStatus.PENDING,
      rejectionReason: data.rejectionReason ?? null,
    });
    return this.repository.save(entity);
  }

  async findById(id: string): Promise<Comment | null> {
    return this.repository.findOne({ where: { id } });
  }

  async countCommentsByDeviceSince(deviceId: string, since: Date): Promise<number> {
    return this.repository
      .createQueryBuilder('c')
      .where('c.device_id = :deviceId AND c.created_at >= :since', { deviceId, since })
      .getCount();
  }
}
