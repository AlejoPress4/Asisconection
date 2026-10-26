import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuthorBadgeDto } from './author-badge.dto';

export class ApprovedCommentItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  content!: string;

  @ApiProperty({ type: () => AuthorBadgeDto })
  author!: AuthorBadgeDto;

  @ApiProperty({ format: 'date-time' })
  created_at!: string;
}

export class ReactionsSummaryDto {
  @ApiProperty({ example: 3 })
  LIKE!: number;

  @ApiProperty({ example: 5 })
  SUPPORT!: number;

  @ApiProperty({ example: 1 })
  THANKS!: number;
}

export class PublicPostItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  category_id!: string;

  @ApiProperty()
  content!: string;

  @ApiPropertyOptional({ type: String, format: 'uri', nullable: true })
  image_url!: string | null;

  @ApiProperty({ type: () => AuthorBadgeDto })
  author!: AuthorBadgeDto;

  @ApiProperty({ type: () => ReactionsSummaryDto })
  reactions_summary!: ReactionsSummaryDto;

  @ApiProperty({ example: 2 })
  comments_count!: number;

  @ApiPropertyOptional({ type: () => [ApprovedCommentItemDto] })
  recent_comments?: ApprovedCommentItemDto[];

  @ApiProperty({ format: 'date-time' })
  created_at!: string;
}
