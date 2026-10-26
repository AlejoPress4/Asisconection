import { ApiProperty } from '@nestjs/swagger';
import { MODERATION_ITEM_TYPES, type ModerationItemType } from './pending-query.dto';
import {
  ALLOWED_MODERATION_DECISIONS,
  type AllowedModerationDecision,
} from './update-moderation-status.dto';

export class ModerationStatusUpdatedDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: MODERATION_ITEM_TYPES })
  item_type!: ModerationItemType;

  @ApiProperty({ enum: ALLOWED_MODERATION_DECISIONS })
  status!: AllowedModerationDecision;

  @ApiProperty({ format: 'date-time' })
  updated_at!: string;
}
