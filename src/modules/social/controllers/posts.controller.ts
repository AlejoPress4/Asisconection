import {
  Body,
  Controller,
  Delete,
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
import { OptionalDeviceSessionGuard } from '../../../common/guards/optional-device-session.guard';
import { CommentsPageDto } from '../dto/comments-page.dto';
import { CreateCommentDto } from '../dto/create-comment.dto';
import { CreatePostDto } from '../dto/create-post.dto';
import {
  ListMySubmissionsQueryDto,
  ListPostsQueryDto,
} from '../dto/list-posts-query.dto';
import {
  NotificationsPageDto,
  NotificationsReadResponseDto,
} from '../dto/notifications-page.dto';
import { PendingSubmissionResponseDto } from '../dto/pending-submission-response.dto';
import { PostsPageDto } from '../dto/posts-page.dto';
import { PublicPostItemDto } from '../dto/public-post-item.dto';
import {
  DeletedResourceResponseDto,
  MyPostSubmissionsPageDto,
  ToggleBookmarkResponseDto,
  UpdatePostDto,
} from '../dto/social-lifecycle.dto';
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
  @UseGuards(OptionalDeviceSessionGuard)
  @ApiOperation({
    summary:
      'Lista exclusivamente publicaciones con status = APPROVED con soporte de feed de conexiones y búsqueda (RT-01, RN-02)',
  })
  @ApiOkResponse({
    description: 'Página ligera de publicaciones aprobadas',
    type: PostsPageDto,
  })
  @ApiBadRequestResponse({
    description: 'Parámetros de consulta inválidos',
    type: ProblemDetailsDto,
  })
  async listApproved(
    @Query() query: ListPostsQueryDto,
    @CurrentSession() optionalSession?: SessionContext,
  ): Promise<PostsPageDto> {
    return this.postsService.listApproved(query, undefined, optionalSession);
  }

  @Get('posts/:id')
  @UseGuards(OptionalDeviceSessionGuard)
  @ApiOperation({
    summary: 'Obtiene el detalle de una publicación aprobada por su UUID',
  })
  @ApiOkResponse({
    description: 'Detalle de publicación aprobada',
    type: PublicPostItemDto,
  })
  @ApiNotFoundResponse({
    description: 'Publicación no encontrada o no aprobada',
    type: ProblemDetailsDto,
  })
  async getApprovedPostById(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentSession() optionalSession?: SessionContext,
  ): Promise<PublicPostItemDto> {
    return this.postsService.getApprovedPostById(id, optionalSession);
  }

  @Patch('posts/:id')
  @UseGuards(DeviceSessionGuard)
  @ApiBearerAuth('DeviceSessionBearer')
  @ApiOperation({
    summary:
      'Edita una publicación propia re-evaluando ContentFilterService y regresando a PENDING conforme a RN-02',
  })
  @ApiOkResponse({
    description: 'Publicación actualizada y re-evaluada por moderación',
    type: PendingSubmissionResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Solo el autor puede editar su publicación',
    type: ProblemDetailsDto,
  })
  @ApiNotFoundResponse({
    description: 'Publicación no encontrada',
    type: ProblemDetailsDto,
  })
  async updatePost(
    @CurrentSession() session: SessionContext | undefined,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePostDto,
  ): Promise<PendingSubmissionResponseDto> {
    return this.postsService.updatePost(requireSession(session), id, dto);
  }

  @Delete('posts/:id')
  @UseGuards(DeviceSessionGuard)
  @ApiBearerAuth('DeviceSessionBearer')
  @ApiOperation({
    summary: 'Elimina una publicación propia o por privilegio ADMIN/MODERATOR',
  })
  @ApiOkResponse({
    description: 'Publicación eliminada',
    type: DeletedResourceResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Sin permisos para eliminar la publicación',
    type: ProblemDetailsDto,
  })
  @ApiNotFoundResponse({
    description: 'Publicación no encontrada',
    type: ProblemDetailsDto,
  })
  async deletePost(
    @CurrentSession() session: SessionContext | undefined,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<DeletedResourceResponseDto> {
    return this.postsService.deletePost(requireSession(session), id);
  }

  @Get('actors/me/submissions')
  @UseGuards(DeviceSessionGuard)
  @ApiBearerAuth('DeviceSessionBearer')
  @ApiOperation({
    summary:
      'Lista todas las publicaciones enviadas por el usuario registrado autenticado incluyendo estados PENDING, APPROVED y REJECTED',
  })
  @ApiOkResponse({
    description: 'Página de envíos propios con estado de moderación',
    type: MyPostSubmissionsPageDto,
  })
  @ApiForbiddenResponse({
    description: 'Exclusivo para usuarios registrados',
    type: ProblemDetailsDto,
  })
  async listMySubmissions(
    @CurrentSession() session: SessionContext | undefined,
    @Query() query: ListMySubmissionsQueryDto,
  ): Promise<MyPostSubmissionsPageDto> {
    return this.postsService.listMySubmissions(requireSession(session), query);
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

  @Delete('comments/:id')
  @UseGuards(DeviceSessionGuard)
  @ApiBearerAuth('DeviceSessionBearer')
  @ApiOperation({
    summary: 'Elimina un comentario propio o por privilegio ADMIN/MODERATOR',
  })
  @ApiOkResponse({
    description: 'Comentario eliminado',
    type: DeletedResourceResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Sin permisos para eliminar el comentario',
    type: ProblemDetailsDto,
  })
  @ApiNotFoundResponse({
    description: 'Comentario no encontrado',
    type: ProblemDetailsDto,
  })
  async deleteComment(
    @CurrentSession() session: SessionContext | undefined,
    @Param('id', new ParseUUIDPipe()) commentId: string,
  ): Promise<DeletedResourceResponseDto> {
    return this.postsService.deleteComment(requireSession(session), commentId);
  }

  @Post('posts/:postId/bookmarks')
  @HttpCode(HttpStatus.OK)
  @UseGuards(DeviceSessionGuard)
  @ApiBearerAuth('DeviceSessionBearer')
  @ApiOperation({
    summary:
      'Guarda o retira (toggle) una publicación aprobada en la colección de marcadores del usuario/dispositivo',
  })
  @ApiOkResponse({
    description: 'Estado resultante del marcador',
    type: ToggleBookmarkResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Publicación no encontrada o no aprobada',
    type: ProblemDetailsDto,
  })
  async toggleBookmark(
    @CurrentSession() session: SessionContext | undefined,
    @Param('postId', new ParseUUIDPipe()) postId: string,
  ): Promise<ToggleBookmarkResponseDto> {
    return this.postsService.toggleBookmark(requireSession(session), postId);
  }

  @Get('bookmarks')
  @UseGuards(DeviceSessionGuard)
  @ApiBearerAuth('DeviceSessionBearer')
  @ApiOperation({
    summary:
      'Lista paginada de publicaciones aprobadas guardadas en marcadores por el usuario/dispositivo actual',
  })
  @ApiOkResponse({
    description: 'Página de publicaciones guardadas',
    type: PostsPageDto,
  })
  async listBookmarks(
    @CurrentSession() session: SessionContext | undefined,
    @Query() query: PaginationQueryDto,
  ): Promise<PostsPageDto> {
    return this.postsService.listBookmarks(requireSession(session), query);
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
  async markNotificationsRead(
    @CurrentSession() session: SessionContext | undefined,
  ): Promise<NotificationsReadResponseDto> {
    return this.postsService.markNotificationsRead(requireSession(session));
  }
}
