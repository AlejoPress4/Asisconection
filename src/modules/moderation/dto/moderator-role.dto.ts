import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

  @ApiPropertyOptional({ example: 'María Gómez' })
  display_name?: string | null;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/avatar.jpg' })
  avatar_url?: string | null;
}
