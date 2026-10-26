import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { ModerationStatus } from '../../../common/enums/moderation-status.enum';

export const ALLOWED_MODERATION_DECISIONS = [
  ModerationStatus.APPROVED,
  ModerationStatus.REJECTED,
] as const;

export type AllowedModerationDecision = (typeof ALLOWED_MODERATION_DECISIONS)[number];

export class UpdateModerationStatusDto {
  @ApiProperty({
    enum: ALLOWED_MODERATION_DECISIONS,
    example: ModerationStatus.APPROVED,
  })
  @IsIn(ALLOWED_MODERATION_DECISIONS)
  status!: AllowedModerationDecision;
}
