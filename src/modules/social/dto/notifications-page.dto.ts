import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';
import type { NotificationEventType } from '../interfaces/i-post.repository';

export class NotificationItemDto {
  @ApiProperty({ example: 'notif-1' })
  id!: string;

  @ApiProperty({
    enum: [
      'COMMENT_ON_POST',
      'REPLY_TO_COMMENT',
      'LIKE_ON_POST',
      'LIKE_ON_COMMENT',
      'FOUNDATION_ANNOUNCEMENT',
      'NEW_FOLLOWER',
    ],
    example: 'COMMENT_ON_POST',
  })
  type!: NotificationEventType;

  @ApiProperty({ example: 'Nuevo comentario en tu publicación' })
  title!: string;

  @ApiProperty({ example: 'Marcela comentó tu publicación.' })
  body!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  actor_id?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Marcela Restrepo' })
  actor_name?: string | null;

  @ApiPropertyOptional({ format: 'uri', nullable: true })
  actor_avatar_url?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  post_id?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  comment_id?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  connection_id?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'ACCEPTED' })
  connection_status?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Apoyo Pedagógico' })
  category_name?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Gracias por compartir la guía...' })
  snippet?: string | null;

  @ApiProperty({ example: false })
  is_read!: boolean;

  @ApiProperty({ format: 'date-time' })
  created_at!: string;
}

export class NotificationsPageDto {
  @ApiProperty({ type: () => [NotificationItemDto] })
  data!: NotificationItemDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMetaDto;
}

export class NotificationsReadResponseDto {
  @ApiProperty({ example: true })
  marked_read!: boolean;

  @ApiProperty({ format: 'date-time' })
  updated_at!: string;
}
