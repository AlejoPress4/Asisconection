import { ApiProperty } from '@nestjs/swagger';
import { ReactionType } from '../../../common/enums/reaction-type.enum';

export class ToggleReactionResponseDto {
  @ApiProperty({ format: 'uuid' })
  post_id!: string;

  @ApiProperty({ enum: ReactionType, example: ReactionType.SUPPORT })
  type!: ReactionType;

  @ApiProperty({
    description: 'true si la reacción quedó activa; false si fue retirada.',
    example: true,
  })
  active!: boolean;
}
