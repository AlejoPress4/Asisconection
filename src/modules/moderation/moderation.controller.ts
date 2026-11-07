import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { DeviceSessionGuard } from '../../common/guards/device-session.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ModerationPendingPageDto } from './dto/moderation-pending-page.dto';
import { ModerationStatusUpdatedDto } from './dto/moderation-status-updated.dto';
import { ModeratorAccountItemDto } from './dto/moderator-role.dto';
import { PendingQueryDto } from './dto/pending-query.dto';
import { UpdateModerationStatusDto } from './dto/update-moderation-status.dto';
import { ModerationService } from './moderation.service';

@ApiTags('Moderation')
@ApiBearerAuth('DeviceSessionBearer')
@UseGuards(DeviceSessionGuard, RolesGuard)
@Controller('admin')
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  /** Lista publicaciones y comentarios en estado PENDING (ADMIN y MODERATOR) */
  @Get('moderation/pending')
  @Roles('ADMIN', 'MODERATOR')
  async listPending(@Query() query: PendingQueryDto): Promise<ModerationPendingPageDto> {
    return this.moderationService.listPending(query);
  }

  /** Aprueba (APPROVED) o rechaza (REJECTED) una publicación */
  @Patch('moderation/posts/:id/status')
  @Roles('ADMIN', 'MODERATOR')
  async updatePostStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateModerationStatusDto,
  ): Promise<ModerationStatusUpdatedDto> {
    return this.moderationService.updatePostStatus(id, dto);
  }

  /** Aprueba (APPROVED) o rechaza (REJECTED) un comentario */
  @Patch('moderation/comments/:id/status')
  @Roles('ADMIN', 'MODERATOR')
  async updateCommentStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateModerationStatusDto,
  ): Promise<ModerationStatusUpdatedDto> {
    return this.moderationService.updateCommentStatus(id, dto);
  }

  /** Lista usuarios con rol global MODERATOR (Exclusivo ADMIN) */
  @Get('moderators')
  @Roles('ADMIN')
  async listModerators(): Promise<ModeratorAccountItemDto[]> {
    return this.moderationService.listModerators();
  }

  /** Asigna rol global MODERATOR a un usuario registrado (Exclusivo ADMIN) */
  @Put('moderators/:userAccountId')
  @Roles('ADMIN')
  async assignModerator(
    @Param('userAccountId', new ParseUUIDPipe()) userAccountId: string,
  ): Promise<ModeratorAccountItemDto> {
    return this.moderationService.assignModerator(userAccountId);
  }

  /** Revoca rol global MODERATOR de un usuario registrado (Exclusivo ADMIN) */
  @Delete('moderators/:userAccountId')
  @Roles('ADMIN')
  async revokeModerator(
    @Param('userAccountId', new ParseUUIDPipe()) userAccountId: string,
  ): Promise<ModeratorAccountItemDto> {
    return this.moderationService.revokeModerator(userAccountId);
  }
}
