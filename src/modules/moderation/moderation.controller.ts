import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { PendingQueryDto } from './dto/pending-query.dto';
import { UpdateModerationStatusDto } from './dto/update-moderation-status.dto';
import { ModerationService } from './moderation.service';

@ApiTags('Moderation')
@ApiBearerAuth('DeviceSessionBearer')
@UseGuards(DeviceSessionGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/moderation')
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Get('pending')
  @ApiOperation({
    summary: 'Lista publicaciones y comentarios en estado PENDING (Solo ADMIN verificado)',
  })
  @ApiOkResponse({
    description: 'Cola paginada de moderación',
    type: ModerationPendingPageDto,
  })
  @ApiBadRequestResponse({
    description: 'Parámetros de consulta inválidos',
    type: ProblemDetailsDto,
  })
  @ApiUnauthorizedResponse({
    description: 'DeviceSession ausente o inválida',
    type: ProblemDetailsDto,
  })
  @ApiForbiddenResponse({
    description: 'Acceso denegado — requiere rol ADMIN activo en UserAccount y BD General',
    type: ProblemDetailsDto,
  })
  async listPending(@Query() query: PendingQueryDto): Promise<ModerationPendingPageDto> {
    return this.moderationService.listPending(query);
  }

  @Patch('posts/:id/status')
  @ApiOperation({
    summary: 'Aprueba (APPROVED) o rechaza (REJECTED) una publicación',
  })
  @ApiOkResponse({
    description: 'Estado de publicación actualizado',
    type: ModerationStatusUpdatedDto,
  })
  @ApiBadRequestResponse({
    description: 'Estado de moderación inválido',
    type: ProblemDetailsDto,
  })
  @ApiUnauthorizedResponse({
    description: 'DeviceSession ausente o inválida',
    type: ProblemDetailsDto,
  })
  @ApiForbiddenResponse({
    description: 'Acceso denegado — requiere rol ADMIN verificado',
    type: ProblemDetailsDto,
  })
  @ApiNotFoundResponse({
    description: 'Publicación no encontrada',
    type: ProblemDetailsDto,
  })
  async updatePostStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateModerationStatusDto,
  ): Promise<ModerationStatusUpdatedDto> {
    return this.moderationService.updatePostStatus(id, dto);
  }

  @Patch('comments/:id/status')
  @ApiOperation({
    summary: 'Aprueba (APPROVED) o rechaza (REJECTED) un comentario',
  })
  @ApiOkResponse({
    description: 'Estado de comentario actualizado',
    type: ModerationStatusUpdatedDto,
  })
  @ApiBadRequestResponse({
    description: 'Estado de moderación inválido',
    type: ProblemDetailsDto,
  })
  @ApiUnauthorizedResponse({
    description: 'DeviceSession ausente o inválida',
    type: ProblemDetailsDto,
  })
  @ApiForbiddenResponse({
    description: 'Acceso denegado — requiere rol ADMIN verificado',
    type: ProblemDetailsDto,
  })
  @ApiNotFoundResponse({
    description: 'Comentario no encontrado',
    type: ProblemDetailsDto,
  })
  async updateCommentStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateModerationStatusDto,
  ): Promise<ModerationStatusUpdatedDto> {
    return this.moderationService.updateCommentStatus(id, dto);
  }
}
