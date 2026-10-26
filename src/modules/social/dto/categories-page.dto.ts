import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';
import { CategoryItemDto } from './category-item.dto';

export class CategoriesPageDto {
  @ApiProperty({ type: () => [CategoryItemDto] })
  data!: CategoryItemDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMetaDto;
}
