import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export const MODERATION_ITEM_TYPES = ['POST', 'COMMENT'] as const;
export type ModerationItemType = (typeof MODERATION_ITEM_TYPES)[number];

export class PendingQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: MODERATION_ITEM_TYPES,
    description: 'Filtrar elementos pendientes por tipo (POST o COMMENT)',
  })
  @IsOptional()
  @IsIn(MODERATION_ITEM_TYPES)
  type?: ModerationItemType;
}
