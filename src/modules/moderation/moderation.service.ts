import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { SessionContext } from '../../common/auth/interfaces/session-context.interface';
import { buildPaginationMeta } from '../../common/dto/pagination.util';
import { ModerationStatus } from '../../common/enums/moderation-status.enum';
import { buildAuthorBadge } from '../social/services/posts.service';
import type {
  ContentReportItemDto,
  ContentReportsPageDto,
  CreateContentReportDto,
  ListContentReportsQueryDto,
  ResolveContentReportDto,
} from './dto/content-report.dto';
import type { ModerationPendingPageDto } from './dto/moderation-pending-page.dto';
import type { ModerationStatusUpdatedDto } from './dto/moderation-status-updated.dto';
import type { ModeratorAccountItemDto } from './dto/moderator-role.dto';
import type { PendingQueryDto } from './dto/pending-query.dto';
import type { UpdateModerationStatusDto } from './dto/update-moderation-status.dto';
import {
  type ContentReportRecord,
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

  async listAccounts(search?: string): Promise<ModeratorAccountItemDto[]> {
    if (!this.moderationRepository.listAccounts) {
      return [];
    }
    const items = await this.moderationRepository.listAccounts(search);
    return items.map((item) => ({
      id: item.id,
      username: item.username,
      email: item.email,
      rol: item.rol,
      local_role: item.localRole,
      display_name: item.displayName ?? null,
      avatar_url: item.avatarUrl ?? null,
    }));
  }

  async listModerators(): Promise<ModeratorAccountItemDto[]> {
    if (!this.moderationRepository.listModerators) {
      return [];
    }
    const items = await this.moderationRepository.listModerators();
    return items.map((item) => ({
      id: item.id,
      username: item.username,
      email: item.email,
      rol: item.rol,
      local_role: item.localRole,
    }));
  }

  async assignModerator(userAccountId: string): Promise<ModeratorAccountItemDto> {
    if (!this.moderationRepository.setLocalRole) {
      throw new NotFoundException('La cuenta de usuario indicada no existe.');
    }
    const updated = await this.moderationRepository.setLocalRole(userAccountId, 'MODERATOR');
    if (!updated) {
      throw new NotFoundException('La cuenta de usuario indicada no existe.');
    }
    return {
      id: updated.id,
      username: updated.username,
      email: updated.email,
      rol: updated.rol,
      local_role: updated.localRole,
    };
  }

  async revokeModerator(userAccountId: string): Promise<ModeratorAccountItemDto> {
    if (!this.moderationRepository.setLocalRole) {
      throw new NotFoundException('La cuenta de usuario indicada no existe.');
    }
    const updated = await this.moderationRepository.setLocalRole(userAccountId, null);
    if (!updated) {
      throw new NotFoundException('La cuenta de usuario indicada no existe.');
    }
    return {
      id: updated.id,
      username: updated.username,
      email: updated.email,
      rol: updated.rol,
      local_role: updated.localRole,
    };
  }

  async createContentReport(
    session: SessionContext,
    dto: CreateContentReportDto,
  ): Promise<ContentReportItemDto> {
    if (!this.moderationRepository.createContentReport) {
      throw new NotFoundException('El contenido que intenta reportar no existe.');
    }

    if (this.moderationRepository.targetExistsAndApproved) {
      const exists = await this.moderationRepository.targetExistsAndApproved(
        dto.target_type,
        dto.target_id,
      );
      if (!exists) {
        throw new NotFoundException(
          'La publicación o comentario que intenta reportar no existe o no se encuentra publicado.',
        );
      }
    }

    if (this.moderationRepository.hasOpenReportByDevice) {
      const alreadyReported = await this.moderationRepository.hasOpenReportByDevice(
        dto.target_type,
        dto.target_id,
        session.sessionId,
      );
      if (alreadyReported) {
        throw new ConflictException(
          'Ya existe un reporte comunitario abierto desde este dispositivo para este contenido.',
        );
      }
    }

    const created = await this.moderationRepository.createContentReport({
      targetType: dto.target_type,
      targetId: dto.target_id,
      reporterDeviceId: session.sessionId,
      reporterUserAccountId: session.userAccountId,
      reason: dto.reason,
      details: dto.details?.trim() ?? null,
    });

    return this.mapContentReportDto(created);
  }

  async listContentReports(query: ListContentReportsQueryDto): Promise<ContentReportsPageDto> {
    if (!this.moderationRepository.findContentReports) {
      return {
        data: [],
        meta: buildPaginationMeta(query.page, query.limit, 0),
      };
    }

    const { items, total } = await this.moderationRepository.findContentReports(
      query.status,
      query.skip,
      query.limit,
    );

    return {
      data: items.map((item) => this.mapContentReportDto(item)),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async resolveContentReport(
    session: SessionContext,
    reportId: string,
    dto: ResolveContentReportDto,
  ): Promise<ContentReportItemDto> {
    if (!this.moderationRepository.resolveContentReport) {
      throw new NotFoundException('El reporte comunitario indicado no existe.');
    }

    const updated = await this.moderationRepository.resolveContentReport(
      reportId,
      dto.status,
      session.userAccountId,
    );

    if (!updated) {
      throw new NotFoundException('El reporte comunitario indicado no existe.');
    }

    if (dto.status === 'RESOLVED' && dto.reject_target === true && updated.targetId) {
      if (updated.targetType === 'POST') {
        await this.moderationRepository.updatePostStatus(
          updated.targetId,
          ModerationStatus.REJECTED,
        );
      } else {
        await this.moderationRepository.updateCommentStatus(
          updated.targetId,
          ModerationStatus.REJECTED,
        );
      }
    }

    return this.mapContentReportDto(updated);
  }

  private mapContentReportDto(record: ContentReportRecord): ContentReportItemDto {
    return {
      id: record.id,
      target_type: record.targetType,
      target_id: record.targetId,
      ...(record.targetContentPreview !== undefined
        ? { target_content_preview: record.targetContentPreview }
        : {}),
      reason: record.reason,
      details: record.details,
      status: record.status,
      reporter_device_id: record.reporterDeviceId,
      reporter_user_account_id: record.reporterUserAccountId,
      resolved_by_user_account_id: record.resolvedByUserAccountId,
      resolved_at: record.resolvedAt ? record.resolvedAt.toISOString() : null,
      created_at: record.createdAt.toISOString(),
    };
  }
}
