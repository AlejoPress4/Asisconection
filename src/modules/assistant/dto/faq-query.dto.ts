import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class FaqQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    maxLength: 60,
    description: 'Filtrar preguntas frecuentes por categoría (ej. Inscripciones, Programas, Voluntariado)',
    example: 'Inscripciones',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;
}
