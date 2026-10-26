import { ApiProperty } from '@nestjs/swagger';

export class CategoryItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Apoyo Pedagógico' })
  name!: string;

  @ApiProperty({
    example: 'Espacio para compartir experiencias educativas y acompañamiento familiar.',
  })
  description!: string;
}
