import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';

export class NotificationItemDto {
  @ApiProperty({ example: 'notif-1' })
  id!: string;

  @ApiProperty({
    enum: [
      'COMMENT_ON_POST',
      'REPLY_TO_COMMENT',
      'LIKE_ON_POST',
      'FOUNDATION_ANNOUNCEMENT',
      'NEW_FOLLOWER',
    ],
    example: 'COMMENT_ON_POST',
  })
  type!:
    | 'COMMENT_ON_POST'
    | 'REPLY_TO_COMMENT'
    | 'LIKE_ON_POST'
    | 'FOUNDATION_ANNOUNCEMENT'
    | 'NEW_FOLLOWER';

  @ApiProperty({ example: 'Nuevo comentario en tu publicación' })
  title!: string;

  @ApiProperty({ example: 'Marcela comentó tu publicación.' })
  body!: string;

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
