import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ModeratorAccountItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  actor_id?: string | null;

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

  @ApiPropertyOptional({ example: true })
  is_active?: boolean;
}

export class UpdateAccountStatusDto {
  @ApiProperty({
    example: true,
    description: 'true para activar/validar la cuenta, false para suspenderla.',
  })
  @IsBoolean()
  is_active!: boolean;
}
