import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { SessionContext } from '../../../common/auth/interfaces/session-context.interface';
import { CurrentSession } from '../../../common/decorators/current-session.decorator';
import { ProblemDetailsDto } from '../../../common/filters/all-exceptions.filter';
import { DeviceSessionGuard } from '../../../common/guards/device-session.guard';
import { CreateCommentDto } from '../dto/create-comment.dto';
import { CreatePostDto } from '../dto/create-post.dto';
import { ListPostsQueryDto } from '../dto/list-posts-query.dto';
import { PendingSubmissionResponseDto } from '../dto/pending-submission-response.dto';
import { PostsPageDto } from '../dto/posts-page.dto';
import { ToggleReactionResponseDto } from '../dto/toggle-reaction-response.dto';
import { ToggleReactionDto } from '../dto/toggle-reaction.dto';
import { PostsService } from '../services/posts.service';

function requireSession(session: SessionContext | undefined): SessionContext {
  if (!session) {
    throw new UnauthorizedException('Se requiere una sesión de dispositivo válida.');
  }
  return session;
}

@ApiTags('Social')
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
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

  @Post()
  @UseGuards(DeviceSessionGuard)
  @ApiBearerAuth('DeviceSessionBearer')
  @ApiOperation({
    summary: 'Crea publicación forzando status = PENDING (RN-02)',
  })
  @ApiCreatedResponse({
    description: 'Publicación creada en cola de moderación humana (PENDING)',
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
  async createPost(
    @CurrentSession() session: SessionContext | undefined,
    @Body() dto: CreatePostDto,
  ): Promise<PendingSubmissionResponseDto> {
    return this.postsService.createPost(requireSession(session), dto);
  }

  @Post(':postId/comments')
  @UseGuards(DeviceSessionGuard)
  @ApiBearerAuth('DeviceSessionBearer')
  @ApiOperation({
    summary: 'Crea comentario forzando status = PENDING sobre publicación aprobada',
  })
  @ApiCreatedResponse({
    description: 'Comentario registrado en estado PENDING',
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
  async createComment(
    @CurrentSession() session: SessionContext | undefined,
    @Param('postId', new ParseUUIDPipe()) postId: string,
    @Body() dto: CreateCommentDto,
  ): Promise<PendingSubmissionResponseDto> {
    return this.postsService.createComment(requireSession(session), postId, dto);
  }

  @Post(':postId/reactions')
  @HttpCode(HttpStatus.OK)
  @UseGuards(DeviceSessionGuard)
  @ApiBearerAuth('DeviceSessionBearer')
  @ApiOperation({
    summary: 'Registra o elimina (toggle) una reacción rápida (LIKE, SUPPORT, THANKS)',
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
}
