import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';
import { ModerationPendingItemDto } from './moderation-pending-item.dto';

export class ModerationPendingPageDto {
  @ApiProperty({ type: () => [ModerationPendingItemDto] })
  data!: ModerationPendingItemDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMetaDto;
}
