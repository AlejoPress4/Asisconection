import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ModerationStatus } from '../../../common/enums/moderation-status.enum';

export class PendingSubmissionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    enum: [ModerationStatus.PENDING, ModerationStatus.REJECTED],
    example: ModerationStatus.PENDING,
  })
  status!: ModerationStatus.PENDING | ModerationStatus.REJECTED;

  @ApiPropertyOptional({
    nullable: true,
    enum: ['AUTO_FILTER', 'HUMAN'],
    example: null,
  })
  rejection_reason?: string | null;

  @ApiProperty({
    example: 'Contenido recibido y enviado a moderación humana antes de su publicación.',
  })
  message!: string;

  @ApiProperty({ format: 'date-time' })
  created_at!: string;
}
