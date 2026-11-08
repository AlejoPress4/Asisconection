import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';
import { ApprovedCommentItemDto } from './public-post-item.dto';

export class CommentsPageDto {
  @ApiProperty({ type: () => [ApprovedCommentItemDto] })
  data!: ApprovedCommentItemDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMetaDto;
}
