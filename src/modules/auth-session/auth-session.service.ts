import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { SessionContext } from '../../common/auth/interfaces/session-context.interface';
import { SessionTokenService } from '../../common/auth/session-token.service';
import type {
  AnonymousSessionResponseDto,
  AuthSessionResponseDto,
  LogoutSessionResponseDto,
} from './dto/auth-session-response.dto';
import type { InitAnonymousSessionDto } from './dto/init-anonymous.dto';
import {
  type CurrentSessionResponseDto,
  toCurrentSessionDto,
} from './dto/current-session-response.dto';
import type { RegisterUserDto } from './dto/register-user.dto';
import type { SyncSessionDto } from './dto/sync-session.dto';
import {
  type IUserSyncRepository,
  USER_SYNC_REPOSITORY,
} from './interfaces/i-local-user.repository';
import {
  EXTERNAL_AUTH_ADAPTER,
  type IExternalAuthAdapter,
} from './interfaces/i-render-auth.adapter';
import { resolveAnonymousNickname } from './utils/anonymous-nickname.util';

@Injectable()
export class AuthSessionService {
  constructor(
    @Inject(EXTERNAL_AUTH_ADAPTER)
    private readonly externalAuthAdapter: IExternalAuthAdapter,
    @Inject(USER_SYNC_REPOSITORY)
    private readonly userSyncRepository: IUserSyncRepository,
    private readonly sessionTokenService: SessionTokenService,
  ) {}

  async register(
    dto: RegisterUserDto,
    optionalSession?: SessionContext,
  ): Promise<AuthSessionResponseDto> {
    const normalizedUsername = dto.username.trim();
    const normalizedEmail = dto.email.trim().toLowerCase();

    const existingLocal = await this.userSyncRepository.findByIdentity(
      null,
      normalizedUsername,
      normalizedEmail,
    );
    if (existingLocal) {
      if (existingLocal.email.trim().toLowerCase() === normalizedEmail) {
        throw new ConflictException(
          'Ya existe una cuenta registrada con este correo electrónico. Inicia sesión con tu cuenta existente.',
        );
      }
      throw new ConflictException(
        'El nombre de usuario ya está en uso en AsisConexión. Elige otro nombre de usuario.',
      );
    }

    const externalUser = await this.externalAuthAdapter.registerUser({
      username: normalizedUsername,
      email: normalizedEmail,
      clave: dto.clave,
      rol: dto.rol,
    });

    const effectiveRol = externalUser.rol.trim().toUpperCase();
    const existingAnonymousSessionId =
      optionalSession && optionalSession.userAccountId === null
        ? optionalSession.sessionId
        : undefined;

    const { user, session } = await this.userSyncRepository.upsertUserAndSession({
      externalUserId: externalUser.externalUserId,
      username: externalUser.username,
      email: externalUser.email,
      rol: effectiveRol,
      externalRoles: externalUser.roles,
      existingAnonymousSessionId,
      isNewRegistration: true,
      signSessionToken: ({ sessionId, userAccountId, role }) =>
        this.sessionTokenService.sign({
          sub: sessionId,
          uid: userAccountId,
          role,
          typ: 'device_session',
        }),
    });

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        rol: user.rol,
        external_roles: user.externalRoles,
        local_role: user.localRole,
      },
      device_token: session.deviceToken,
      synced_with_global_db: true,
    };
  }

  async syncSession(
    dto: SyncSessionDto,
    optionalSession?: SessionContext,
  ): Promise<AuthSessionResponseDto> {
    const rawIdentifier = (dto.email ?? dto.identifier ?? '').trim();
    if (!rawIdentifier) {
      throw new BadRequestException('Debe proporcionar email o identifier para iniciar sesión.');
    }

    const externalUser = await this.externalAuthAdapter.authenticateUser(rawIdentifier, dto.clave);

    const effectiveExternalId = externalUser.externalUserId;
    const effectiveUsername = externalUser.username;
    const effectiveEmail = externalUser.email;
    const effectiveRol = externalUser.rol.trim().toUpperCase();

    const existingAccount = await this.userSyncRepository.findByIdentity(
      effectiveExternalId,
      effectiveUsername,
      effectiveEmail,
    );

    if (existingAccount && !existingAccount.isActive) {
      throw new UnauthorizedException('La cuenta de usuario se encuentra inactiva.');
    }

    const existingAnonymousSessionId =
      optionalSession && optionalSession.userAccountId === null
        ? optionalSession.sessionId
        : undefined;

    const { user, session } = await this.userSyncRepository.upsertUserAndSession({
      externalUserId: effectiveExternalId,
      username: effectiveUsername,
      email: effectiveEmail,
      rol: effectiveRol,
      externalRoles: externalUser.roles,
      existingAnonymousSessionId,
      signSessionToken: ({ sessionId, userAccountId, role }) =>
        this.sessionTokenService.sign({
          sub: sessionId,
          uid: userAccountId,
          role,
          typ: 'device_session',
        }),
    });

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        rol: user.rol,
        external_roles: user.externalRoles,
        local_role: user.localRole,
      },
      device_token: session.deviceToken,
      synced_with_global_db: true,
    };
  }

  async login(
    dto: SyncSessionDto,
    optionalSession?: SessionContext,
  ): Promise<AuthSessionResponseDto> {
    return this.syncSession(dto, optionalSession);
  }

  async initAnonymous(dto: InitAnonymousSessionDto): Promise<AnonymousSessionResponseDto> {
    const nickname = resolveAnonymousNickname(dto.nickname);
    const roleTag = dto.role_tag?.trim().toUpperCase() || 'VISITANTE';

    const session = await this.userSyncRepository.createAnonymousSession({
      nickname,
      roleTag,
      signSessionToken: ({ sessionId, userAccountId, role }) =>
        this.sessionTokenService.sign({
          sub: sessionId,
          uid: userAccountId,
          role,
          typ: 'device_session',
        }),
    });

    return {
      device_token: session.deviceToken,
      session_id: session.id,
      nickname: session.nickname ?? nickname,
      role_tag: session.roleTag ?? roleTag,
    };
  }

  async logout(session: SessionContext): Promise<LogoutSessionResponseDto> {
    const isAnonymous = session.userAccountId === null;
    const { purged } = await this.userSyncRepository.revokeOrDeleteSession(
      session.sessionId,
      isAnonymous,
    );

    return {
      logged_out: true,
      session_id: session.sessionId,
      purged,
    };
  }

  getCurrentSession(session: SessionContext): CurrentSessionResponseDto {
    return toCurrentSessionDto(session);
  }
}
