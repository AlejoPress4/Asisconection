import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuthorBadgeDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  actor_id?: string | null;

  @ApiProperty({ example: 'maria.acudiente' })
  display_name!: string;

  @ApiProperty({ example: 'ACUDIENTE' })
  role_label!: string;

  @ApiPropertyOptional({ type: String, format: 'uri', nullable: true })
  avatar_url?: string | null;

  @ApiProperty({ example: true })
  is_registered!: boolean;
}
