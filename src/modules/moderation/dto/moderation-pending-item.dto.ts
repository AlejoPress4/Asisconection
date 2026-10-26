import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ModerationStatus } from '../../../common/enums/moderation-status.enum';
import { AuthorBadgeDto } from '../../social/dto/author-badge.dto';
import { MODERATION_ITEM_TYPES, type ModerationItemType } from './pending-query.dto';

export class ModerationPendingItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: MODERATION_ITEM_TYPES })
  item_type!: ModerationItemType;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  post_id!: string | null;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  category_id!: string | null;

  @ApiProperty()
  content!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  image_url!: string | null;

  @ApiProperty({ enum: [ModerationStatus.PENDING], example: ModerationStatus.PENDING })
  status!: ModerationStatus.PENDING;

  @ApiProperty({ format: 'uuid' })
  device_id!: string;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  user_account_id!: string | null;

  @ApiProperty({ type: () => AuthorBadgeDto })
  author!: AuthorBadgeDto;

  @ApiProperty({ format: 'date-time' })
  created_at!: string;
}
