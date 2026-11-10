import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
   Patch,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { SessionContext } from '../../../common/auth/interfaces/session-context.interface';
import { CurrentSession } from '../../../common/decorators/current-session.decorator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { ProblemDetailsDto } from '../../../common/filters/all-exceptions.filter';
import { DeviceSessionGuard } from '../../../common/guards/device-session.guard';
import { CommentsPageDto } from '../dto/comments-page.dto';
import { CreateCommentDto } from '../dto/create-comment.dto';
import { CreatePostDto } from '../dto/create-post.dto';
import { ListPostsQueryDto } from '../dto/list-posts-query.dto';
import {
  NotificationsPageDto,
  NotificationsReadResponseDto,
} from '../dto/notifications-page.dto';
import { PendingSubmissionResponseDto } from '../dto/pending-submission-response.dto';
import { PostsPageDto } from '../dto/posts-page.dto';
import {
  ToggleCommentReactionResponseDto,
  ToggleReactionResponseDto,
} from '../dto/toggle-reaction-response.dto';
import { ToggleReactionDto } from '../dto/toggle-reaction.dto';
import { PostsService } from '../services/posts.service';

function requireSession(session: SessionContext | undefined): SessionContext {
  if (!session) {
    throw new UnauthorizedException('Se requiere una sesión de dispositivo válida.');
  }
  return session;
}

@ApiTags('Social')
@Controller()
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get('posts')
  @ApiOperation({
    summary: 'Lista exclusivamente publicaciones con status = APPROVED (RT-01, RN-02)',
  })
  @ApiOkResponse({
    description: 'Página ligera de publicaciones aprobadas',
    type: PostsPageDto,
  })
  @ApiBadRequestResponse({
    description: 'Parámetros de consulta inválidos',
    type: ProblemDetailsDto,
  })
  async listApproved(@Query() query: ListPostsQueryDto): Promise<PostsPageDto> {
    return this.postsService.listApproved(query);
  }

  @Get('actors/me/posts')
  @UseGuards(DeviceSessionGuard)
  @ApiBearerAuth('DeviceSessionBearer')
  @ApiOperation({
    summary: 'Lista paginada de publicaciones aprobadas del usuario autenticado',
  })
  @ApiOkResponse({
    description: 'Página de publicaciones propias aprobadas',
    type: PostsPageDto,
  })
  @ApiUnauthorizedResponse({
    description: 'DeviceSession ausente o inválida',
    type: ProblemDetailsDto,
  })
  @ApiForbiddenResponse({
    description: 'Exclusivo para usuarios registrados',
    type: ProblemDetailsDto,
  })
  async listMyPosts(
    @CurrentSession() session: SessionContext | undefined,
    @Query() query: PaginationQueryDto,
  ): Promise<PostsPageDto> {
    return this.postsService.listMyApprovedPosts(requireSession(session), query);
  }

  @Get('actors/:id/posts')
  @ApiOperation({
    summary: 'Lista paginada de publicaciones aprobadas de un perfil Actor específico',
  })
  @ApiOkResponse({
    description: 'Página de publicaciones aprobadas del actor consultado',
    type: PostsPageDto,
  })
  @ApiNotFoundResponse({
    description: 'Perfil Actor no encontrado',
    type: ProblemDetailsDto,
  })
  async listActorPosts(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PostsPageDto> {
    return this.postsService.listActorApprovedPosts(id, query);
  }

  @Post('posts')
  @UseGuards(DeviceSessionGuard)
  @ApiBearerAuth('DeviceSessionBearer')
  @ApiOperation({
    summary: 'Crea publicación evaluando filtro automático previo y cola PENDING (RN-02)',
  })
  @ApiCreatedResponse({
    description: 'Publicación recibida (PENDING o REJECTED por AUTO_FILTER)',
    type: PendingSubmissionResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Datos inválidos',
    type: ProblemDetailsDto,
  })
  @ApiUnauthorizedResponse({
    description: 'DeviceSession ausente o inválida',
    type: ProblemDetailsDto,
  })
  @ApiForbiddenResponse({
    description: 'Ausencia de consentimiento legal para adjuntar imágenes',
    type: ProblemDetailsDto,
  })
  @ApiNotFoundResponse({
    description: 'Categoría no encontrada',
    type: ProblemDetailsDto,
  })
  @ApiTooManyRequestsResponse({
    description: 'Límite diario de publicaciones anónimas excedido',
    type: ProblemDetailsDto,
  })
  async createPost(
    @CurrentSession() session: SessionContext | undefined,
    @Body() dto: CreatePostDto,
  ): Promise<PendingSubmissionResponseDto> {
    return this.postsService.createPost(requireSession(session), dto);
  }

  @Get('posts/:postId/comments')
  @ApiOperation({
    summary: 'Lista paginada de comentarios aprobados (status = APPROVED) de una publicación',
  })
  @ApiOkResponse({
    description: 'Página de comentarios aprobados de la publicación',
    type: CommentsPageDto,
  })
  @ApiBadRequestResponse({
    description: 'Parámetros inválidos',
    type: ProblemDetailsDto,
  })
  @ApiNotFoundResponse({
    description: 'Publicación no encontrada o no aprobada',
    type: ProblemDetailsDto,
  })
  async listApprovedComments(
    @Param('postId', new ParseUUIDPipe()) postId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<CommentsPageDto> {
    return this.postsService.listApprovedComments(postId, query);
  }

  @Post('posts/:postId/comments')
  @UseGuards(DeviceSessionGuard)
  @ApiBearerAuth('DeviceSessionBearer')
  @ApiOperation({
    summary: 'Crea comentario o respuesta en hilo (parent_id) con filtro automático y cola PENDING',
  })
  @ApiCreatedResponse({
    description: 'Comentario registrado en estado PENDING o REJECTED (AUTO_FILTER)',
    type: PendingSubmissionResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Datos inválidos',
    type: ProblemDetailsDto,
  })
  @ApiUnauthorizedResponse({
    description: 'DeviceSession ausente o inválida',
    type: ProblemDetailsDto,
  })
  @ApiNotFoundResponse({
    description: 'Publicación no encontrada o no aprobada',
    type: ProblemDetailsDto,
  })
  @ApiTooManyRequestsResponse({
    description: 'Límite diario de comentarios anónimos excedido',
    type: ProblemDetailsDto,
  })
  async createComment(
    @CurrentSession() session: SessionContext | undefined,
    @Param('postId', new ParseUUIDPipe()) postId: string,
    @Body() dto: CreateCommentDto,
  ): Promise<PendingSubmissionResponseDto> {
    return this.postsService.createComment(requireSession(session), postId, dto);
  }

  @Post('posts/:postId/reactions')
  @HttpCode(HttpStatus.OK)
  @UseGuards(DeviceSessionGuard)
  @ApiBearerAuth('DeviceSessionBearer')
  @ApiOperation({
    summary: 'Registra o elimina (toggle) una reacción rápida en publicación (LIKE, SUPPORT, THANKS)',
  })
  @ApiOkResponse({
    description: 'Estado resultante de la reacción para el dispositivo actual',
    type: ToggleReactionResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Tipo de reacción inválido',
    type: ProblemDetailsDto,
  })
  @ApiUnauthorizedResponse({
    description: 'DeviceSession ausente o inválida',
    type: ProblemDetailsDto,
  })
  @ApiNotFoundResponse({
    description: 'Publicación no encontrada o no aprobada',
    type: ProblemDetailsDto,
  })
  async toggleReaction(
    @CurrentSession() session: SessionContext | undefined,
    @Param('postId', new ParseUUIDPipe()) postId: string,
    @Body() dto: ToggleReactionDto,
  ): Promise<ToggleReactionResponseDto> {
    return this.postsService.toggleReaction(requireSession(session), postId, dto);
  }

  @Post('comments/:id/reactions')
  @HttpCode(HttpStatus.OK)
  @UseGuards(DeviceSessionGuard)
  @ApiBearerAuth('DeviceSessionBearer')
  @ApiOperation({
    summary: 'Registra o elimina (toggle) una reacción rápida en un comentario aprobado',
  })
  @ApiOkResponse({
    description: 'Estado resultante de la reacción sobre el comentario',
    type: ToggleCommentReactionResponseDto,
  })
  async toggleCommentReaction(
    @CurrentSession() session: SessionContext | undefined,
    @Param('id', new ParseUUIDPipe()) commentId: string,
    @Body() dto: ToggleReactionDto,
  ): Promise<ToggleCommentReactionResponseDto> {
    return this.postsService.toggleCommentReaction(requireSession(session), commentId, dto);
  }

  @Get('notifications')
  @UseGuards(DeviceSessionGuard)
  @ApiBearerAuth('DeviceSessionBearer')
  @ApiOperation({
    summary: 'Lista notificaciones recientes de actividad comunitaria del actor autenticado',
  })
  @ApiOkResponse({
    description: 'Página de notificaciones recientes (últimos 30 días)',
    type: NotificationsPageDto,
  })
  async listNotifications(
    @CurrentSession() session: SessionContext | undefined,
    @Query() query: PaginationQueryDto,
  ): Promise<NotificationsPageDto> {
    return this.postsService.listNotifications(requireSession(session), query);
  }

  @Patch('notifications/read-all')
  @UseGuards(DeviceSessionGuard)
  @ApiBearerAuth('DeviceSessionBearer')
  @ApiOperation({
    summary: 'Marca todas las notificaciones del actor como leídas',
  })
  @ApiOkResponse({
    description: 'Confirmación de marcado de notificaciones como leídas',
    type: NotificationsReadResponseDto,
  })
  markNotificationsRead(
    @CurrentSession() session: SessionContext | undefined,
  ): NotificationsReadResponseDto {
    return this.postsService.markNotificationsRead(requireSession(session));
  }
}
