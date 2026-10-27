import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({ minLength: 1, maxLength: 1000 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @Length(1, 1000)
  content!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'ID del comentario padre para respuestas en hilo.',
  })
  @IsOptional()
  @IsUUID()
  parent_id?: string;
}
