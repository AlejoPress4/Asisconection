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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { SessionContext } from '../../../common/auth/interfaces/session-context.interface';
import { CurrentSession } from '../../../common/decorators/current-session.decorator';
import { DeviceSessionGuard } from '../../../common/guards/device-session.guard';
import { CreateCommentDto } from '../dto/create-comment.dto';
import { CreatePostDto } from '../dto/create-post.dto';
import { ListPostsQueryDto } from '../dto/list-posts-query.dto';
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

  /** Lista exclusivamente publicaciones con status = APPROVED (RT-01, RN-02) */
  @Get('posts')
  async listApproved(@Query() query: ListPostsQueryDto): Promise<PostsPageDto> {
    return this.postsService.listApproved(query);
  }

  /** Crea publicación evaluando filtro automático previo y cola PENDING (RN-02) */
  @Post('posts')
  @UseGuards(DeviceSessionGuard)
  @ApiBearerAuth('DeviceSessionBearer')
  async createPost(
    @CurrentSession() session: SessionContext | undefined,
    @Body() dto: CreatePostDto,
  ): Promise<PendingSubmissionResponseDto> {
    return this.postsService.createPost(requireSession(session), dto);
  }

  /** Crea comentario o respuesta en hilo (parent_id) con filtro automático y cola PENDING */
  @Post('posts/:postId/comments')
  @UseGuards(DeviceSessionGuard)
  @ApiBearerAuth('DeviceSessionBearer')
  async createComment(
    @CurrentSession() session: SessionContext | undefined,
    @Param('postId', new ParseUUIDPipe()) postId: string,
    @Body() dto: CreateCommentDto,
  ): Promise<PendingSubmissionResponseDto> {
    return this.postsService.createComment(requireSession(session), postId, dto);
  }

  /** Alterna (toggle) una reacción rápida en publicación (LIKE, SUPPORT, THANKS) */
  @Post('posts/:postId/reactions')
  @HttpCode(HttpStatus.OK)
  @UseGuards(DeviceSessionGuard)
  @ApiBearerAuth('DeviceSessionBearer')
  async toggleReaction(
    @CurrentSession() session: SessionContext | undefined,
    @Param('postId', new ParseUUIDPipe()) postId: string,
    @Body() dto: ToggleReactionDto,
  ): Promise<ToggleReactionResponseDto> {
    return this.postsService.toggleReaction(requireSession(session), postId, dto);
  }

  /** Alterna (toggle) una reacción rápida en un comentario aprobado */
  @Post('comments/:id/reactions')
  @HttpCode(HttpStatus.OK)
  @UseGuards(DeviceSessionGuard)
  @ApiBearerAuth('DeviceSessionBearer')
  async toggleCommentReaction(
    @CurrentSession() session: SessionContext | undefined,
    @Param('id', new ParseUUIDPipe()) commentId: string,
    @Body() dto: ToggleReactionDto,
  ): Promise<ToggleCommentReactionResponseDto> {
    return this.postsService.toggleCommentReaction(requireSession(session), commentId, dto);
  }
}
