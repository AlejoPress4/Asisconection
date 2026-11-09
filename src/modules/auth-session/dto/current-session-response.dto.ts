import { ApiProperty } from '@nestjs/swagger';
import type { SessionContext } from '../../../common/auth/interfaces/session-context.interface';

/**
 * Snapshot of the DeviceSession that owns the Bearer token (ISP: never exposes
 * `device_token`, `clave` nor internal identifiers of the central identity service).
 * Lets clients restore a session after a restart, including anonymous sessions and
 * the local global role MODERATOR assigned by an ADMIN.
 */
export class CurrentSessionResponseDto {
  @ApiProperty({ format: 'uuid' })
  session_id!: string;

  @ApiProperty({ example: false })
  is_anonymous!: boolean;

  @ApiProperty({ type: String, nullable: true, format: 'uuid' })
  user_account_id!: string | null;

  @ApiProperty({
    example: 'maria.acudiente',
    description: 'Username for registered accounts or nickname for anonymous sessions.',
  })
  display_name!: string;

  @ApiProperty({ example: 'ACUDIENTE' })
  rol!: string;

  @ApiProperty({ type: [String], example: ['ACUDIENTE'] })
  external_roles!: string[];

  @ApiProperty({ type: String, nullable: true, enum: ['MODERATOR'], example: null })
  local_role!: string | null;

  @ApiProperty({ example: true })
  has_consent!: boolean;
}

const ANONYMOUS_FALLBACK_NAME = 'Invitado';
const ANONYMOUS_FALLBACK_ROLE = 'BENEFICIARIO';

export function toCurrentSessionDto(session: SessionContext): CurrentSessionResponseDto {
  const isAnonymous = session.userAccountId === null;
  return {
    session_id: session.sessionId,
    is_anonymous: isAnonymous,
    user_account_id: session.userAccountId,
    display_name: isAnonymous
      ? (session.nickname ?? ANONYMOUS_FALLBACK_NAME)
      : (session.username ?? ANONYMOUS_FALLBACK_NAME),
    rol: isAnonymous
      ? (session.roleTag ?? ANONYMOUS_FALLBACK_ROLE)
      : (session.rol ?? ANONYMOUS_FALLBACK_ROLE),
    external_roles: [...(session.externalRoles ?? [])],
    local_role: session.localRole ?? null,
    has_consent: session.consentAcceptedAt !== null,
  };
}
