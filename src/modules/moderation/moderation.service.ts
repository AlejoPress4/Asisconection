import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { buildPaginationMeta } from '../../common/dto/pagination.util';
import { ModerationStatus } from '../../common/enums/moderation-status.enum';
import { buildAuthorBadge } from '../social/services/posts.service';
import type { ModerationPendingPageDto } from './dto/moderation-pending-page.dto';
import type { ModerationStatusUpdatedDto } from './dto/moderation-status-updated.dto';
import type { PendingQueryDto } from './dto/pending-query.dto';
import type { UpdateModerationStatusDto } from './dto/update-moderation-status.dto';
import {
  type IModerationRepository,
  MODERATION_REPOSITORY,
} from './interfaces/i-moderation.repository';

@Injectable()
export class ModerationService {
  constructor(
    @Inject(MODERATION_REPOSITORY)
    private readonly moderationRepository: IModerationRepository,
  ) {}

  async listPending(query: PendingQueryDto): Promise<ModerationPendingPageDto> {
    const { items, total } = await this.moderationRepository.findPending(
      query.type,
      query.skip,
      query.limit,
    );

    return {
      data: items.map((item) => ({
        id: item.id,
        item_type: item.itemType,
        post_id: item.postId,
        category_id: item.categoryId,
        content: item.content,
        image_url: item.imageUrl,
        status: ModerationStatus.PENDING,
        device_id: item.deviceId,
        user_account_id: item.userAccountId,
        author: buildAuthorBadge(item),
        created_at: item.createdAt.toISOString(),
      })),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async updatePostStatus(
    id: string,
    dto: UpdateModerationStatusDto,
  ): Promise<ModerationStatusUpdatedDto> {
    const updated = await this.moderationRepository.updatePostStatus(id, dto.status);
    if (!updated) {
      throw new NotFoundException('La publicación indicada no existe.');
    }

    return {
      id: updated.id,
      item_type: updated.itemType,
      status: updated.status,
      updated_at: updated.updatedAt.toISOString(),
    };
  }

  async updateCommentStatus(
    id: string,
    dto: UpdateModerationStatusDto,
  ): Promise<ModerationStatusUpdatedDto> {
    const updated = await this.moderationRepository.updateCommentStatus(id, dto.status);
    if (!updated) {
      throw new NotFoundException('El comentario indicado no existe.');
    }

    return {
      id: updated.id,
      item_type: updated.itemType,
      status: updated.status,
      updated_at: updated.updatedAt.toISOString(),
    };
  }
}
