import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';
import type { ActorConnectionStatus } from '../entities/actor-connection.entity';

export class ActorProfileResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  user_account_id!: string;

  @ApiProperty({ example: 'maria.acudiente' })
  username!: string;

  @ApiPropertyOptional({ nullable: true, format: 'email', example: 'maria@correo.com' })
  email?: string | null;

  @ApiProperty({ example: 'ACUDIENTE' })
  primary_role!: string;

  @ApiPropertyOptional({ type: String, nullable: true, enum: ['MODERATOR'], example: null })
  local_role?: string | null;

  @ApiProperty({ nullable: true, example: 'María' })
  first_names!: string | null;

  @ApiProperty({ nullable: true, example: 'Gómez' })
  last_names!: string | null;

  @ApiProperty({ nullable: true, format: 'uri', example: 'https://cdn.asisco.org/avatars/1.jpg' })
  avatar_url!: string | null;

  @ApiProperty({ nullable: true, example: 'Acudiente participante en programas comunitarios.' })
  short_bio!: string | null;

  @ApiPropertyOptional({ nullable: true, example: '1988-05-14' })
  birth_date?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Manizales' })
  city?: string | null;

  @ApiPropertyOptional({ example: false })
  show_email?: boolean;

  @ApiPropertyOptional({ example: false })
  show_birth_date?: boolean;

  @ApiPropertyOptional({ example: false })
  show_city?: boolean;

  @ApiPropertyOptional({ example: false })
  require_follow_approval?: boolean;

  @ApiPropertyOptional({ example: 0 })
  posts_count?: number;

  @ApiPropertyOptional({ example: 0 })
  followers_count?: number;

  @ApiPropertyOptional({ example: 0 })
  following_count?: number;

  @ApiProperty({ format: 'date-time' })
  created_at!: string;

  @ApiProperty({ format: 'date-time' })
  updated_at!: string;
}

export class UpdateActorProfileDto {
  @ApiPropertyOptional({ maxLength: 40, example: 'ACUDIENTE' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  primary_role?: string;

  @ApiPropertyOptional({ maxLength: 80, example: 'María' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  first_names?: string;

  @ApiPropertyOptional({ maxLength: 80, example: 'Gómez' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  last_names?: string;

  @ApiPropertyOptional({ maxLength: 500, example: 'https://cdn.asisco.org/avatars/1.jpg' })
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(500)
  avatar_url?: string;

  @ApiPropertyOptional({ maxLength: 500, example: 'Acudiente participante en talleres.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  short_bio?: string;

  @ApiPropertyOptional({ maxLength: 10, format: 'date', example: '1988-05-14' })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, {
    message: 'birth_date debe tener formato YYYY-MM-DD.',
  })
  birth_date?: string;

  @ApiPropertyOptional({ maxLength: 80, example: 'Manizales' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  show_email?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  show_birth_date?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  show_city?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  require_follow_approval?: boolean;
}

export class CreateConnectionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  receiver_actor_id!: string;
}

export class UpdateConnectionStatusDto {
  @ApiProperty({ enum: ['ACCEPTED', 'BLOCKED'], example: 'ACCEPTED' })
  @IsString()
  @IsIn(['ACCEPTED', 'BLOCKED'])
  status!: 'ACCEPTED' | 'BLOCKED';
}

export class ActorConnectionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  requester_actor_id!: string;

  @ApiProperty({ format: 'uuid' })
  receiver_actor_id!: string;

  @ApiProperty({ enum: ['PENDING', 'ACCEPTED', 'BLOCKED'] })
  status!: ActorConnectionStatus;

  @ApiProperty({ format: 'date-time' })
  requested_at!: string;

  @ApiProperty({ nullable: true, format: 'date-time' })
  accepted_at!: string | null;
}

export class ActorConnectionsPageDto {
  @ApiProperty({ type: () => [ActorConnectionResponseDto] })
  data!: ActorConnectionResponseDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMetaDto;
}
