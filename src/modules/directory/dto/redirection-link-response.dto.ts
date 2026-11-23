import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';

export class RedirectionLinkItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'SUMA 21' })
  project_name!: string;

  @ApiProperty({ format: 'uri', example: 'https://suma21.fundacionasisco.org' })
  url!: string;

  @ApiProperty({ example: 'Plataforma de inclusión y formación integral.' })
  description!: string;
}

export class CreateRedirectionLinkDto {
  @ApiProperty({
    description: 'Nombre del proyecto o programa del ecosistema',
    example: 'SUMA 21',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  project_name!: string;

  @ApiProperty({
    description: 'URL oficial del proyecto o canal de contacto',
    format: 'uri',
    example: 'https://suma21.fundacionasisco.org',
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  url!: string;

  @ApiProperty({
    description: 'Descripción breve del proyecto',
    example: 'Plataforma de inclusión y formación integral.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1500)
  description!: string;
}

export class UpdateRedirectionLinkDto {
  @ApiPropertyOptional({
    description: 'Nombre actualizado del proyecto',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  project_name?: string;

  @ApiPropertyOptional({
    description: 'URL actualizada del proyecto',
    format: 'uri',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  url?: string;

  @ApiPropertyOptional({
    description: 'Descripción actualizada del proyecto',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Estado de visibilidad activa en el directorio',
  })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class DeletedRedirectionLinkResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: true })
  deleted!: boolean;
}

export class RedirectionLinksPageDto {
  @ApiProperty({ type: () => [RedirectionLinkItemDto] })
  data!: RedirectionLinkItemDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMetaDto;
}
