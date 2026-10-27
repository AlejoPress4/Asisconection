import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PublicUserDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'maria.acudiente' })
  username!: string;

  @ApiProperty({ format: 'email', example: 'maria@prueba.com' })
  email!: string;

  @ApiProperty({ example: 'ACUDIENTE' })
  rol!: string;

  @ApiPropertyOptional({ type: [String], example: ['ACUDIENTE'] })
  external_roles?: string[];

  @ApiPropertyOptional({ nullable: true, example: null })
  local_role?: string | null;
}

export class AuthSessionResponseDto {
  @ApiProperty({ type: () => PublicUserDto })
  user!: PublicUserDto;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  device_token!: string;

  @ApiProperty({ example: true })
  synced_with_global_db!: boolean;
}

export class AnonymousSessionResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  device_token!: string;

  @ApiProperty({ format: 'uuid' })
  session_id!: string;
}
