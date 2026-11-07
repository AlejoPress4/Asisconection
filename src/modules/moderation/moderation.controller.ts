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
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { ProblemDetailsDto } from '../../common/filters/all-exceptions.filter';
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

  @Get('moderation/pending')
  @Roles('ADMIN', 'MODERATOR')
  @ApiOperation({ summary: 'Lista publicaciones y comentarios en estado PENDING (ADMIN y MODERATOR)' })
  @ApiOkResponse({ type: ModerationPendingPageDto })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  async listPending(@Query() query: PendingQueryDto): Promise<ModerationPendingPageDto> {
    return this.moderationService.listPending(query);
  }

  @Patch('moderation/posts/:id/status')
  @Roles('ADMIN', 'MODERATOR')
  @ApiOperation({ summary: 'Aprueba (APPROVED) o rechaza (REJECTED) una publicación' })
  @ApiOkResponse({ type: ModerationStatusUpdatedDto })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  async updatePostStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateModerationStatusDto,
  ): Promise<ModerationStatusUpdatedDto> {
    return this.moderationService.updatePostStatus(id, dto);
  }

  @Patch('moderation/comments/:id/status')
  @Roles('ADMIN', 'MODERATOR')
  @ApiOperation({ summary: 'Aprueba (APPROVED) o rechaza (REJECTED) un comentario' })
  @ApiOkResponse({ type: ModerationStatusUpdatedDto })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  async updateCommentStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateModerationStatusDto,
  ): Promise<ModerationStatusUpdatedDto> {
    return this.moderationService.updateCommentStatus(id, dto);
  }

  @Get('moderators')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Lista usuarios con rol global MODERATOR (Exclusivo ADMIN)' })
  @ApiOkResponse({ type: [ModeratorAccountItemDto] })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  async listModerators(): Promise<ModeratorAccountItemDto[]> {
    return this.moderationService.listModerators();
  }

  @Put('moderators/:userAccountId')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Asigna rol global MODERATOR a un usuario registrado (Exclusivo ADMIN)' })
  @ApiOkResponse({ type: ModeratorAccountItemDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  async assignModerator(
    @Param('userAccountId', new ParseUUIDPipe()) userAccountId: string,
  ): Promise<ModeratorAccountItemDto> {
    return this.moderationService.assignModerator(userAccountId);
  }

  @Delete('moderators/:userAccountId')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Revoca rol global MODERATOR de un usuario registrado (Exclusivo ADMIN)' })
  @ApiOkResponse({ type: ModeratorAccountItemDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  async revokeModerator(
    @Param('userAccountId', new ParseUUIDPipe()) userAccountId: string,
  ): Promise<ModeratorAccountItemDto> {
    return this.moderationService.revokeModerator(userAccountId);
  }
}
