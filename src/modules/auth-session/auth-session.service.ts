import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { SessionContext } from '../../common/auth/interfaces/session-context.interface';
import { SessionTokenService } from '../../common/auth/session-token.service';
import type {
  AnonymousSessionResponseDto,
  AuthSessionResponseDto,
} from './dto/auth-session-response.dto';
import type { InitAnonymousSessionDto } from './dto/init-anonymous.dto';
import type { RegisterUserDto } from './dto/register-user.dto';
import type { SyncSessionDto } from './dto/sync-session.dto';
import {
  GLOBAL_USER_REPOSITORY,
  type GlobalUserRecord,
  type IGlobalUserRepository,
} from './interfaces/i-global-user.repository';
import {
  type IUserSyncRepository,
  USER_SYNC_REPOSITORY,
} from './interfaces/i-local-user.repository';
import {
  EXTERNAL_AUTH_ADAPTER,
  type IExternalAuthAdapter,
} from './interfaces/i-render-auth.adapter';

@Injectable()
export class AuthSessionService {
  constructor(
    @Inject(EXTERNAL_AUTH_ADAPTER)
    private readonly externalAuthAdapter: IExternalAuthAdapter,
    @Inject(GLOBAL_USER_REPOSITORY)
    private readonly globalUserRepository: IGlobalUserRepository,
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
      throw new ConflictException(
        'El username o email ya se encuentra registrado en AsisConexión.',
      );
    }

    const externalUser = await this.externalAuthAdapter.registerUser({
      username: normalizedUsername,
      email: normalizedEmail,
      clave: dto.clave,
      rol: dto.rol,
    });

    let globalUser: GlobalUserRecord | null = null;
    try {
      globalUser =
        (await this.globalUserRepository.findByUsernameOrEmail(externalUser.username)) ??
        (await this.globalUserRepository.findByUsernameOrEmail(externalUser.email));
    } catch {
      globalUser = null;
    }

    const syncedWithGlobalDb = globalUser !== null;
    const effectiveExternalId = globalUser?.id ?? externalUser.externalUserId;
    const effectiveRol = (globalUser?.rol ?? externalUser.rol).trim().toUpperCase();

    const existingAnonymousSessionId =
      optionalSession && optionalSession.userAccountId === null
        ? optionalSession.sessionId
        : undefined;

    const { user, session } = await this.userSyncRepository.upsertUserAndSession({
      externalUserId: effectiveExternalId,
      username: globalUser?.username ?? externalUser.username,
      email: globalUser?.email ?? externalUser.email,
      rol: effectiveRol,
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
      },
      device_token: session.deviceToken,
      synced_with_global_db: syncedWithGlobalDb,
    };
  }

  async syncSession(
    dto: SyncSessionDto,
    optionalSession?: SessionContext,
  ): Promise<AuthSessionResponseDto> {
    const externalUser = await this.externalAuthAdapter.authenticateUser(
      dto.identifier,
      dto.clave,
    );

    const globalUser =
      (await this.globalUserRepository.findByUsernameOrEmail(dto.identifier)) ??
      (await this.globalUserRepository.findByUsernameOrEmail(externalUser.username)) ??
      (await this.globalUserRepository.findByUsernameOrEmail(externalUser.email));

    const effectiveExternalId = globalUser?.id ?? externalUser.externalUserId;
    const effectiveUsername = globalUser?.username ?? externalUser.username;
    const effectiveEmail = globalUser?.email ?? externalUser.email;
    const effectiveRol = (globalUser?.rol ?? externalUser.rol).trim().toUpperCase();

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
      },
      device_token: session.deviceToken,
      synced_with_global_db: globalUser !== null,
    };
  }

  async initAnonymous(dto: InitAnonymousSessionDto): Promise<AnonymousSessionResponseDto> {
    const session = await this.userSyncRepository.createAnonymousSession({
      nickname: dto.nickname,
      roleTag: dto.role_tag,
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
    };
  }
}
