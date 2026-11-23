import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';

export class FaqItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: '¿Cómo inscribo a un beneficiario en SUMA 21?' })
  question!: string;

  @ApiProperty({
    example:
      'Puedes acercarte a la sede principal o comunicarte por el canal oficial de WhatsApp con el documento de identidad del acudiente y del beneficiario.',
  })
  answer!: string;

  @ApiProperty({ example: 'Inscripciones' })
  category!: string;
}

export class CreateFaqDto {
  @ApiProperty({
    description: 'Pregunta frecuente de la base de conocimiento',
    example: '¿Cómo inscribo a un beneficiario en SUMA 21?',
    maxLength: 300,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  question!: string;

  @ApiProperty({
    description: 'Respuesta oficial verificada',
    example:
      'Puedes acercarte a la sede principal o comunicarte por el canal oficial de WhatsApp.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(3000)
  answer!: string;

  @ApiProperty({
    description: 'Categoría temática de la pregunta frecuente',
    example: 'Inscripciones',
    maxLength: 60,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  category!: string;
}

export class UpdateFaqDto {
  @ApiPropertyOptional({
    description: 'Pregunta frecuente actualizada',
    maxLength: 300,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  question?: string;

  @ApiPropertyOptional({
    description: 'Respuesta oficial actualizada',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(3000)
  answer?: string;

  @ApiPropertyOptional({
    description: 'Categoría temática actualizada',
    maxLength: 60,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  category?: string;
}

export class DeletedFaqResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: true })
  deleted!: boolean;
}

export class FaqPageDto {
  @ApiProperty({
    example:
      'Esta orientación automatizada es de carácter informativo y no reemplaza la atención profesional o administrativa directa de la Fundación Asisco.',
  })
  disclaimer!: string;

  @ApiProperty({ type: () => [FaqItemDto] })
  data!: FaqItemDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMetaDto;
}
