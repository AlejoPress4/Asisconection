import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsUrl, IsUUID, Length, MaxLength } from 'class-validator';

export class CreatePostDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  category_id!: string;

  @ApiProperty({ minLength: 1, maxLength: 2000 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @Length(1, 2000)
  content!: string;

  @ApiPropertyOptional({ format: 'uri', maxLength: 500 })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(500)
  image_url?: string;
}
