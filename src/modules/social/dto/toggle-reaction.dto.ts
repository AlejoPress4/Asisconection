import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ReactionType } from '../../../common/enums/reaction-type.enum';

export class ToggleReactionDto {
  @ApiProperty({ enum: ReactionType, example: ReactionType.SUPPORT })
  @IsEnum(ReactionType)
  type!: ReactionType;
}
