import { ApiProperty } from '@nestjs/swagger';
import { ModerationStatus } from '../../../common/enums/moderation-status.enum';

export class PendingSubmissionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: [ModerationStatus.PENDING], example: ModerationStatus.PENDING })
  status!: ModerationStatus.PENDING;

  @ApiProperty({
    example: 'Contenido recibido y enviado a moderación humana antes de su publicación.',
  })
  message!: string;

  @ApiProperty({ format: 'date-time' })
  created_at!: string;
}
