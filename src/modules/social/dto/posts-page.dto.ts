import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';
import { PublicPostItemDto } from './public-post-item.dto';

export class PostsPageDto {
  @ApiProperty({ type: () => [PublicPostItemDto] })
  data!: PublicPostItemDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMetaDto;
}
