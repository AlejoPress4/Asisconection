import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import type { DataSource, EntityManager } from 'typeorm';
import { Actor } from '../entities/actor.entity';
import { DeviceSession } from '../entities/device-session.entity';
import { UserAccount } from '../entities/user-account.entity';
import type {
  CreateAnonymousSessionInput,
  IUserSyncRepository,
  SyncUserSessionInput,
} from '../interfaces/i-local-user.repository';

@Injectable()
export class LocalUserRepository implements IUserSyncRepository {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async findByIdentity(
    externalUserId: number | null,
    username: string,
    email: string,
  ): Promise<UserAccount | null> {
    return this.findAccountWithManager(this.dataSource.manager, externalUserId, username, email);
  }

  async upsertUserAndSession(
    input: SyncUserSessionInput,
  ): Promise<{ user: UserAccount; actor: Actor; session: DeviceSession }> {
    return this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(UserAccount);
      const actorRepo = manager.getRepository(Actor);
      const sessionRepo = manager.getRepository(DeviceSession);
      const now = new Date();

      const existingUser = await this.findAccountWithManager(
        manager,
        input.externalUserId,
        input.username,
        input.email,
        input.isNewRegistration === true,
      );

      if (existingUser && !existingUser.isActive) {
        throw new UnauthorizedException('La cuenta de usuario se encuentra inactiva.');
      }

      const normalizedExternalRoles =
        input.externalRoles && input.externalRoles.length > 0
          ? [...input.externalRoles]
          : [input.rol];

      const trimmedUsername = input.username.trim();
      const normalizedEmail = input.email.trim().toLowerCase();
      const isEmailFallbackUsername = trimmedUsername.toLowerCase() === normalizedEmail;
      const effectiveUsername =
        existingUser && isEmailFallbackUsername ? existingUser.username : trimmedUsername;

      const userToSave = existingUser
        ? userRepo.merge(existingUser, {
            externalUserId: input.externalUserId ?? existingUser.externalUserId,
            username: effectiveUsername,
            email: normalizedEmail,
            rol: input.rol,
            externalRoles: normalizedExternalRoles,
            lastSyncedAt: now,
          })
        : userRepo.create({
            externalUserId: input.externalUserId,
            username: trimmedUsername,
            email: normalizedEmail,
            rol: input.rol,
            externalRoles: normalizedExternalRoles,
            localRole: null,
            isActive: true,
            lastSyncedAt: now,
          });

      const savedUser = await userRepo.save(userToSave);

      const existingActor = await actorRepo.findOne({
        where: { userAccountId: savedUser.id },
      });

      const actorToSave = existingActor
        ? actorRepo.merge(existingActor, {
            primaryRole: existingActor.primaryRole || savedUser.rol,
          })
        : actorRepo.create({
            userAccountId: savedUser.id,
            primaryRole: savedUser.rol,
            firstNames: null,
            lastNames: null,
            avatarUrl: null,
            shortBio: null,
          });

      const savedActor = await actorRepo.save(actorToSave);

      let targetSession: DeviceSession | null = null;
      if (input.existingAnonymousSessionId) {
        const candidate = await sessionRepo.findOne({
          where: { id: input.existingAnonymousSessionId },
        });
        if (candidate && candidate.userAccountId === null) {
          targetSession = candidate;
        }
      }

      const sessionId = targetSession ? targetSession.id : randomUUID();
      const deviceToken = input.signSessionToken({
        sessionId,
        userAccountId: savedUser.id,
        role: savedUser.rol,
      });

      const sessionToSave = targetSession
        ? sessionRepo.merge(targetSession, {
            userAccountId: savedUser.id,
            deviceToken,
            nickname: savedUser.username,
            roleTag: savedUser.rol,
            consentAcceptedAt: now,
          })
        : sessionRepo.create({
            id: sessionId,
            userAccountId: savedUser.id,
            deviceToken,
            nickname: savedUser.username,
            roleTag: savedUser.rol,
            consentAcceptedAt: now,
          });

      const savedSession = await sessionRepo.save(sessionToSave);

      if (targetSession) {
        await manager.query(
          `UPDATE posts SET user_account_id = $1::uuid WHERE device_id = $2::uuid AND user_account_id IS NULL`,
          [savedUser.id, targetSession.id],
        );
        await manager.query(
          `UPDATE comments SET user_account_id = $1::uuid WHERE device_id = $2::uuid AND user_account_id IS NULL`,
          [savedUser.id, targetSession.id],
        );
        await manager.query(
          `UPDATE reactions SET user_account_id = $1::uuid WHERE device_id = $2::uuid AND user_account_id IS NULL`,
          [savedUser.id, targetSession.id],
        );
        await manager.query(
          `UPDATE comment_reactions SET user_account_id = $1::uuid WHERE device_id = $2::uuid AND user_account_id IS NULL`,
          [savedUser.id, targetSession.id],
        );
        await manager.query(
          `UPDATE post_bookmarks SET user_account_id = $1::uuid WHERE device_id = $2::uuid AND user_account_id IS NULL`,
          [savedUser.id, targetSession.id],
        );
      }

      return {
        user: savedUser,
        actor: savedActor,
        session: savedSession,
      };
    });
  }

  async createAnonymousSession(input: CreateAnonymousSessionInput): Promise<DeviceSession> {
    const sessionRepo = this.dataSource.getRepository(DeviceSession);
    const sessionId = randomUUID();
    const normalizedNickname = input.nickname?.trim() ? input.nickname.trim() : null;
    const normalizedRoleTag = input.roleTag?.trim() ? input.roleTag.trim() : null;

    const deviceToken = input.signSessionToken({
      sessionId,
      userAccountId: null,
      role: normalizedRoleTag ?? 'VISITANTE',
    });

    const session = sessionRepo.create({
      id: sessionId,
      userAccountId: null,
      deviceToken,
      nickname: normalizedNickname,
      roleTag: normalizedRoleTag,
      consentAcceptedAt: new Date(),
    });

    return sessionRepo.save(session);
  }

  private async findAccountWithManager(
    manager: EntityManager,
    externalUserId: number | null,
    username: string,
    email: string,
    isNewRegistration = false,
  ): Promise<UserAccount | null> {
    const userRepo = manager.getRepository(UserAccount);

    const byExternal =
      externalUserId !== null && externalUserId !== undefined
        ? await userRepo.findOne({ where: { externalUserId } })
        : null;

    const normalizedUsername = username.trim().toLowerCase();
    const byUsername = normalizedUsername
      ? await userRepo
          .createQueryBuilder('u')
          .where('LOWER(u.username) = :normalizedUsername', { normalizedUsername })
          .getOne()
      : null;

    const normalizedEmail = email.trim().toLowerCase();
    const byEmail = normalizedEmail
      ? await userRepo
          .createQueryBuilder('u')
          .where('LOWER(u.email) = :normalizedEmail', { normalizedEmail })
          .getOne()
      : null;

    const matches = [byExternal, byUsername, byEmail].filter(
      (candidate): candidate is UserAccount => candidate !== null,
    );

    if (matches.length === 0) {
      return null;
    }

    if (isNewRegistration) {
      throw new ConflictException(
        'El username o email ya se encuentra registrado en AsisConexión.',
      );
    }

    const distinctIds = new Set(matches.map((u) => u.id));
    if (distinctIds.size > 1) {
      throw new ConflictException(
        'Conflicto de identidad: el username y el email pertenecen a cuentas distintas.',
      );
    }

    const matched = matches[0]!;
    if (
      externalUserId !== null &&
      externalUserId !== undefined &&
      matched.externalUserId !== null &&
      matched.externalUserId !== externalUserId
    ) {
      throw new ConflictException(
        'Conflicto de identidad: el correo o usuario ya está vinculado a otra cuenta externa.',
      );
    }

    return matched;
  }
}
