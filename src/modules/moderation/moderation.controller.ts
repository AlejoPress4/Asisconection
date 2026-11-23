import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { SessionContext } from '../../common/auth/interfaces/session-context.interface';
import { CurrentSession } from '../../common/decorators/current-session.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ProblemDetailsDto } from '../../common/filters/all-exceptions.filter';
import { DeviceSessionGuard } from '../../common/guards/device-session.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  ContentReportItemDto,
  ContentReportsPageDto,
  CreateContentReportDto,
  ListContentReportsQueryDto,
  ResolveContentReportDto,
} from './dto/content-report.dto';
import { ModerationPendingPageDto } from './dto/moderation-pending-page.dto';
import { ModerationStatusUpdatedDto } from './dto/moderation-status-updated.dto';
import { ModeratorAccountItemDto } from './dto/moderator-role.dto';
import { PendingQueryDto } from './dto/pending-query.dto';
import { UpdateModerationStatusDto } from './dto/update-moderation-status.dto';
import { ModerationService } from './moderation.service';

function requireSession(session: SessionContext | undefined): SessionContext {
  if (!session) {
    throw new UnauthorizedException('Se requiere una sesión de dispositivo válida.');
  }
  return session;
}

@ApiTags('Moderation')
@ApiBearerAuth('DeviceSessionBearer')
@UseGuards(DeviceSessionGuard, RolesGuard)
@Controller()
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Post('reports')
  @ApiOperation({
    summary: 'Crea un reporte o denuncia comunitaria sobre una publicación o comentario aprobado',
  })
  @ApiCreatedResponse({
    description: 'Reporte comunitario creado en estado OPEN',
    type: ContentReportItemDto,
  })
  @ApiNotFoundResponse({
    description: 'Contenido reportado no encontrado o no aprobado',
    type: ProblemDetailsDto,
  })
  @ApiConflictResponse({
    description: 'Reporte abierto duplicado para el mismo dispositivo y contenido',
    type: ProblemDetailsDto,
  })
  async createContentReport(
    @CurrentSession() session: SessionContext | undefined,
    @Body() dto: CreateContentReportDto,
  ): Promise<ContentReportItemDto> {
    return this.moderationService.createContentReport(requireSession(session), dto);
  }

  @Get('admin/moderation/reports')
  @Roles('ADMIN', 'MODERATOR')
  @ApiOperation({
    summary: 'Lista paginada de reportes comunitarios de contenido (Abierto a ADMIN y MODERATOR)',
  })
  @ApiOkResponse({
    description: 'Página de reportes comunitarios',
    type: ContentReportsPageDto,
  })
  @ApiForbiddenResponse({
    description: 'Acceso denegado — requiere rol ADMIN o MODERATOR activo',
    type: ProblemDetailsDto,
  })
  async listContentReports(
    @Query() query: ListContentReportsQueryDto,
  ): Promise<ContentReportsPageDto> {
    return this.moderationService.listContentReports(query);
  }

  @Patch('admin/moderation/reports/:id/resolve')
  @Roles('ADMIN', 'MODERATOR')
  @ApiOperation({
    summary:
      'Resuelve (RESOLVED) o descarta (DISMISSED) un reporte comunitario con opción de retirar el contenido reportado',
  })
  @ApiOkResponse({
    description: 'Reporte comunitario actualizado',
    type: ContentReportItemDto,
  })
  @ApiForbiddenResponse({
    description: 'Acceso denegado — requiere rol ADMIN o MODERATOR activo',
    type: ProblemDetailsDto,
  })
  @ApiNotFoundResponse({
    description: 'Reporte comunitario no encontrado',
    type: ProblemDetailsDto,
  })
  async resolveContentReport(
    @CurrentSession() session: SessionContext | undefined,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ResolveContentReportDto,
  ): Promise<ContentReportItemDto> {
    return this.moderationService.resolveContentReport(requireSession(session), id, dto);
  }

  @Get('admin/moderation/pending')
  @Roles('ADMIN', 'MODERATOR')
  @ApiOperation({
    summary: 'Lista publicaciones y comentarios en estado PENDING (Abierto a ADMIN y MODERATOR)',
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
    description: 'Acceso denegado — requiere rol ADMIN o MODERATOR activo',
    type: ProblemDetailsDto,
  })
  async listPending(@Query() query: PendingQueryDto): Promise<ModerationPendingPageDto> {
    return this.moderationService.listPending(query);
  }

  @Patch('admin/moderation/posts/:id/status')
  @Roles('ADMIN', 'MODERATOR')
  @ApiOperation({
    summary: 'Aprueba (APPROVED) o rechaza (REJECTED con rejection_reason = HUMAN) una publicación',
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
    description: 'Acceso denegado — requiere rol ADMIN o MODERATOR',
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

  @Patch('admin/moderation/comments/:id/status')
  @Roles('ADMIN', 'MODERATOR')
  @ApiOperation({
    summary: 'Aprueba (APPROVED) o rechaza (REJECTED con rejection_reason = HUMAN) un comentario',
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
    description: 'Acceso denegado — requiere rol ADMIN o MODERATOR',
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

  @Get('admin/accounts')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Lista y busca cuentas registradas para asignación de moderadores (Exclusivo ADMIN)',
  })
  @ApiOkResponse({
    type: [ModeratorAccountItemDto],
  })
  @ApiForbiddenResponse({
    description: 'Acceso denegado — exclusivo para rol ADMIN',
    type: ProblemDetailsDto,
  })
  async listAccounts(
    @Query('search') search?: string,
  ): Promise<ModeratorAccountItemDto[]> {
    return this.moderationService.listAccounts(search);
  }

  @Get('admin/moderators')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Lista usuarios registrados con rol local global MODERATOR (Exclusivo ADMIN)',
  })
  @ApiOkResponse({
    type: [ModeratorAccountItemDto],
  })
  @ApiForbiddenResponse({
    description: 'Acceso denegado — exclusivo para rol ADMIN',
    type: ProblemDetailsDto,
  })
  async listModerators(): Promise<ModeratorAccountItemDto[]> {
    return this.moderationService.listModerators();
  }

  @Put('admin/moderators/:userAccountId')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Asigna el rol global local MODERATOR a un usuario registrado (Exclusivo ADMIN)',
  })
  @ApiOkResponse({
    type: ModeratorAccountItemDto,
  })
  @ApiForbiddenResponse({
    description: 'Acceso denegado — exclusivo para rol ADMIN',
    type: ProblemDetailsDto,
  })
  async assignModerator(
    @Param('userAccountId', new ParseUUIDPipe()) userAccountId: string,
  ): Promise<ModeratorAccountItemDto> {
    return this.moderationService.assignModerator(userAccountId);
  }

  @Delete('admin/moderators/:userAccountId')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Revoca el rol global local MODERATOR de un usuario registrado (Exclusivo ADMIN)',
  })
  @ApiOkResponse({
    type: ModeratorAccountItemDto,
  })
  @ApiForbiddenResponse({
    description: 'Acceso denegado — exclusivo para rol ADMIN',
    type: ProblemDetailsDto,
  })
  async revokeModerator(
    @Param('userAccountId', new ParseUUIDPipe()) userAccountId: string,
  ): Promise<ModeratorAccountItemDto> {
    return this.moderationService.revokeModerator(userAccountId);
  }
}
