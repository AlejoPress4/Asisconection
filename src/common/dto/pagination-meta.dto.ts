import { ApiProperty } from '@nestjs/swagger';

export class PaginationMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 42 })
  total_items!: number;

  @ApiProperty({ example: 3 })
  total_pages!: number;

  @ApiProperty({ example: true })
  has_next_page!: boolean;
}
