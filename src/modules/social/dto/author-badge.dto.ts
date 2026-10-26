import { ApiProperty } from '@nestjs/swagger';

export class AuthorBadgeDto {
  @ApiProperty({ example: 'maria.acudiente' })
  display_name!: string;

  @ApiProperty({ example: 'ACUDIENTE' })
  role_label!: string;

  @ApiProperty({ example: true })
  is_registered!: boolean;
}
