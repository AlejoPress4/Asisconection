import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CategoryItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Apoyo Pedagógico' })
  name!: string;

  @ApiPropertyOptional({ example: 'Educación Inclusiva' })
  main_topic?: string;

  @ApiProperty({
    example: 'Espacio para compartir experiencias educativas y acompañamiento familiar.',
  })
  description!: string;

  @ApiPropertyOptional({ nullable: true, format: 'uri' })
  cover_image_url?: string | null;
}
