import { ApiProperty } from '@nestjs/swagger';

export class ModeratorAccountItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'maria.acudiente' })
  username!: string;

  @ApiProperty({ format: 'email', example: 'maria@prueba.com' })
  email!: string;

  @ApiProperty({ example: 'ACUDIENTE' })
  rol!: string;

  @ApiProperty({ nullable: true, example: 'MODERATOR' })
  local_role!: string | null;
}
