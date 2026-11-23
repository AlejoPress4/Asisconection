import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { ModerationStatus } from '../../../common/enums/moderation-status.enum';

export class ListPostsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Filtrar publicaciones aprobadas por categoría temática',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    enum: ['discover', 'following'],
    default: 'discover',
    description: 'Modo de feed: discover (público general) o following (red de conexiones ACCEPTED)',
  })
  @IsOptional()
  @IsString()
  @IsIn(['discover', 'following'])
  feed?: 'discover' | 'following';

  @ApiPropertyOptional({
    maxLength: 100,
    description: 'Búsqueda por palabra clave o #hashtag sobre el contenido aprobado',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class ListMySubmissionsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: ModerationStatus,
    description: 'Filtrar envíos propios por estado de moderación (PENDING, APPROVED, REJECTED)',
  })
  @IsOptional()
  @IsString()
  @IsIn([ModerationStatus.PENDING, ModerationStatus.APPROVED, ModerationStatus.REJECTED])
  status?: ModerationStatus;
}
