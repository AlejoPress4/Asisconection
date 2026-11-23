import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';
import { ModerationStatus } from '../../../common/enums/moderation-status.enum';

export class UpdatePostDto {
  @ApiPropertyOptional({
    maxLength: 2000,
    example: 'Texto actualizado de la experiencia comunitaria.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content?: string;

  @ApiPropertyOptional({
    format: 'uri',
    maxLength: 500,
    example: 'https://cdn.fundacionasisco.org/posts/taller-2.jpg',
  })
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(500)
  image_url?: string;

  @ApiPropertyOptional({
    type: [String],
    maxItems: 5,
    description: 'Arreglo de URLs multimedia actualizadas (solo URLs http/https)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true }, { each: true })
  @MaxLength(500, { each: true })
  media_urls?: string[];
}

export class DeletedResourceResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: true })
  deleted!: boolean;
}

export class MyPostSubmissionItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  category_id!: string;

  @ApiProperty()
  content!: string;

  @ApiPropertyOptional({ type: String, format: 'uri', nullable: true })
  image_url!: string | null;

  @ApiProperty({ type: [String] })
  media_urls!: string[];

  @ApiProperty({ enum: ModerationStatus })
  status!: ModerationStatus;

  @ApiPropertyOptional({ type: String, nullable: true, enum: ['AUTO_FILTER', 'HUMAN'] })
  rejection_reason!: string | null;

  @ApiProperty({ format: 'date-time' })
  created_at!: string;

  @ApiProperty({ format: 'date-time' })
  updated_at!: string;
}

export class MyPostSubmissionsPageDto {
  @ApiProperty({ type: () => [MyPostSubmissionItemDto] })
  data!: MyPostSubmissionItemDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMetaDto;
}

export class ToggleBookmarkResponseDto {
  @ApiProperty({ format: 'uuid' })
  post_id!: string;

  @ApiProperty({
    example: true,
    description: 'true si la publicación quedó guardada en marcadores; false si fue retirada',
  })
  bookmarked!: boolean;
}
