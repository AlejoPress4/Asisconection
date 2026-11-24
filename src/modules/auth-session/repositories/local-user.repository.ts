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
    const userRepo = this.dataSource.manager.getRepository(UserAccount);

    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail) {
      const byEmail = await userRepo
        .createQueryBuilder('u')
        .where('LOWER(u.email) = :normalizedEmail', { normalizedEmail })
        .getOne();
      if (byEmail) {
        return byEmail;
      }
    }

    if (externalUserId !== null && externalUserId !== undefined) {
      const byExternal = await userRepo.findOne({ where: { externalUserId } });
      if (byExternal) {
        return byExternal;
      }
    }

    const normalizedUsername = username.trim().toLowerCase();
    if (normalizedUsername) {
      const byUsername = await userRepo
        .createQueryBuilder('u')
        .where('LOWER(u.username) = :normalizedUsername', { normalizedUsername })
        .getOne();
      if (byUsername) {
        return byUsername;
      }
    }

    return null;
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
      let effectiveUsername =
        existingUser && isEmailFallbackUsername ? existingUser.username : trimmedUsername;

      if (existingUser && effectiveUsername.toLowerCase() !== existingUser.username.toLowerCase()) {
        const usernameCollision = await userRepo
          .createQueryBuilder('u')
          .where('LOWER(u.username) = :uname AND u.id != :uid', {
            uname: effectiveUsername.toLowerCase(),
            uid: existingUser.id,
          })
          .getOne();
        if (usernameCollision) {
          effectiveUsername = existingUser.username;
        }
      }

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

    // If externalUserId matches a local row with a completely different email AND username,
    // the central identity DB reused/reset its sequential ID. Detach the stale externalUserId
    // so we neither block new registrations with a false 409 nor overwrite another user's account.
    let validByExternal = byExternal;
    if (
      byExternal &&
      byExternal.email.trim().toLowerCase() !== normalizedEmail &&
      byExternal.username.trim().toLowerCase() !== normalizedUsername
    ) {
      await userRepo.update({ id: byExternal.id }, { externalUserId: null });
      validByExternal = null;
    }

    const matches = [validByExternal, byUsername, byEmail].filter(
      (candidate): candidate is UserAccount => candidate !== null,
    );

    if (matches.length === 0) {
      return null;
    }

    if (isNewRegistration) {
      if (byEmail) {
        throw new ConflictException(
          'Ya existe una cuenta registrada con este correo electrónico. Inicia sesión con tu cuenta existente.',
        );
      }
      if (byUsername) {
        throw new ConflictException(
          'El nombre de usuario ya está en uso en AsisConexión. Elige otro nombre de usuario.',
        );
      }
      throw new ConflictException(
        'Ya existe una cuenta registrada con estos datos. Inicia sesión con tu cuenta existente.',
      );
    }

    const matched = byEmail ?? validByExternal ?? byUsername!;
    if (validByExternal && validByExternal.id !== matched.id) {
      await userRepo.update({ id: validByExternal.id }, { externalUserId: null });
    }

    return matched;
  }
}
