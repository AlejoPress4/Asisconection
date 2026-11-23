import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
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
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import type { ActorConnectionStatus } from '../entities/actor-connection.entity';

function emptyStringToNull({ value }: { value: unknown }): unknown {
  if (typeof value === 'string' && value.trim() === '') {
    return null;
  }
  return value;
}

export class ViewerConnectionStatusDto {
  @ApiProperty({ format: 'uuid' })
  connection_id!: string;

  @ApiProperty({ enum: ['PENDING', 'ACCEPTED', 'BLOCKED'] })
  status!: ActorConnectionStatus;

  @ApiProperty({ enum: ['OUTGOING', 'INCOMING'] })
  direction!: 'OUTGOING' | 'INCOMING';
}

export class ConnectionPeerActorDto {
  @ApiProperty({ format: 'uuid' })
  actor_id!: string;

  @ApiProperty({ example: 'maria.acudiente' })
  username!: string;

  @ApiProperty({ example: 'María Gómez' })
  display_name!: string;

  @ApiProperty({ example: 'ACUDIENTE' })
  primary_role!: string;

  @ApiProperty({ nullable: true, format: 'uri' })
  avatar_url!: string | null;
}

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

  @ApiPropertyOptional({ type: () => ViewerConnectionStatusDto, nullable: true })
  viewer_connection?: ViewerConnectionStatusDto | null;

  @ApiProperty({ format: 'date-time' })
  created_at!: string;

  @ApiProperty({ format: 'date-time' })
  updated_at!: string;
}

export const ALLOWED_ACTOR_PRIMARY_ROLES = [
  'ACUDIENTE',
  'VOLUNTARIO',
  'INVERSOR',
  'BENEFICIARIO',
] as const;

export class UpdateActorProfileDto {
  @ApiPropertyOptional({
    enum: ALLOWED_ACTOR_PRIMARY_ROLES,
    maxLength: 40,
    example: 'ACUDIENTE',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @IsIn(ALLOWED_ACTOR_PRIMARY_ROLES, {
    message:
      'primary_role debe ser un rol comunitario permitido (ACUDIENTE, VOLUNTARIO, INVERSOR o BENEFICIARIO).',
  })
  primary_role?: string;

  @ApiPropertyOptional({ maxLength: 80, nullable: true, example: 'María' })
  @Transform(emptyStringToNull)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  first_names?: string | null;

  @ApiPropertyOptional({ maxLength: 80, nullable: true, example: 'Gómez' })
  @Transform(emptyStringToNull)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  last_names?: string | null;

  @ApiPropertyOptional({
    maxLength: 500,
    nullable: true,
    example: 'https://cdn.asisco.org/avatars/1.jpg',
  })
  @Transform(emptyStringToNull)
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(500)
  avatar_url?: string | null;

  @ApiPropertyOptional({
    maxLength: 500,
    nullable: true,
    example: 'Acudiente participante en talleres.',
  })
  @Transform(emptyStringToNull)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  short_bio?: string | null;

  @ApiPropertyOptional({ maxLength: 10, format: 'date', nullable: true, example: '1988-05-14' })
  @Transform(emptyStringToNull)
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, {
    message: 'birth_date debe tener formato YYYY-MM-DD.',
  })
  birth_date?: string | null;

  @ApiPropertyOptional({ maxLength: 80, nullable: true, example: 'Manizales' })
  @Transform(emptyStringToNull)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string | null;

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

  @ApiPropertyOptional({ type: () => ConnectionPeerActorDto })
  peer_actor?: ConnectionPeerActorDto;

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

export class ListActorsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Búsqueda por username, nombres, apellidos, biografía o ciudad (si es pública)',
    maxLength: 80,
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por rol comunitario principal (ej. ACUDIENTE, VOLUNTARIO)',
    maxLength: 40,
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  role?: string;
}

export class ActorsPageDto {
  @ApiProperty({ type: () => [ActorProfileResponseDto] })
  data!: ActorProfileResponseDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMetaDto;
}

export class ListConnectionsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['PENDING', 'ACCEPTED', 'BLOCKED'] })
  @IsOptional()
  @IsString()
  @IsIn(['PENDING', 'ACCEPTED', 'BLOCKED'])
  status?: ActorConnectionStatus;

  @ApiPropertyOptional({ enum: ['incoming', 'outgoing', 'all'], default: 'all' })
  @IsOptional()
  @IsString()
  @IsIn(['incoming', 'outgoing', 'all'])
  direction?: 'incoming' | 'outgoing' | 'all';
}

export class DeleteConnectionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: true })
  deleted!: boolean;
}
