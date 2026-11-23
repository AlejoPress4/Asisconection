import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export type ContentReportTargetType = 'POST' | 'COMMENT';

export type ContentReportReason =
  | 'INAPPROPRIATE_CONTENT'
  | 'HARASSMENT'
  | 'MINOR_PRIVACY'
  | 'SPAM'
  | 'OTHER';

export type ContentReportStatus = 'OPEN' | 'RESOLVED' | 'DISMISSED';

export const CONTENT_REPORT_REASONS: ReadonlyArray<ContentReportReason> = [
  'INAPPROPRIATE_CONTENT',
  'HARASSMENT',
  'MINOR_PRIVACY',
  'SPAM',
  'OTHER',
];

export class CreateContentReportDto {
  @ApiProperty({ enum: ['POST', 'COMMENT'], example: 'POST' })
  @IsString()
  @IsIn(['POST', 'COMMENT'])
  target_type!: ContentReportTargetType;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  target_id!: string;

  @ApiProperty({
    enum: CONTENT_REPORT_REASONS,
    example: 'INAPPROPRIATE_CONTENT',
  })
  @IsString()
  @IsIn(CONTENT_REPORT_REASONS)
  reason!: ContentReportReason;

  @ApiPropertyOptional({
    maxLength: 500,
    example: 'El mensaje contiene información sensible no apropiada para el foro.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  details?: string;
}

export class ListContentReportsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['OPEN', 'RESOLVED', 'DISMISSED'] })
  @IsOptional()
  @IsString()
  @IsIn(['OPEN', 'RESOLVED', 'DISMISSED'])
  status?: ContentReportStatus;
}

export class ResolveContentReportDto {
  @ApiProperty({ enum: ['RESOLVED', 'DISMISSED'], example: 'RESOLVED' })
  @IsString()
  @IsIn(['RESOLVED', 'DISMISSED'])
  status!: 'RESOLVED' | 'DISMISSED';

  @ApiPropertyOptional({
    default: false,
    description:
      'Si es true y status = RESOLVED, retira inmediatamente (REJECTED con rejection_reason = HUMAN) el contenido reportado',
  })
  @IsOptional()
  @IsBoolean()
  reject_target?: boolean;
}

export class ContentReportItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ['POST', 'COMMENT'] })
  target_type!: ContentReportTargetType;

  @ApiProperty({ format: 'uuid' })
  target_id!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  target_content_preview?: string | null;

  @ApiProperty({ enum: CONTENT_REPORT_REASONS })
  reason!: ContentReportReason;

  @ApiPropertyOptional({ type: String, nullable: true })
  details!: string | null;

  @ApiProperty({ enum: ['OPEN', 'RESOLVED', 'DISMISSED'] })
  status!: ContentReportStatus;

  @ApiProperty({ format: 'uuid' })
  reporter_device_id!: string;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  reporter_user_account_id!: string | null;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  resolved_by_user_account_id!: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  resolved_at!: string | null;

  @ApiProperty({ format: 'date-time' })
  created_at!: string;
}

export class ContentReportsPageDto {
  @ApiProperty({ type: () => [ContentReportItemDto] })
  data!: ContentReportItemDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMetaDto;
}
