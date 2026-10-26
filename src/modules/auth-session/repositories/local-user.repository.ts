import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import type { DataSource, EntityManager } from 'typeorm';
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
    externalUserId: string | null,
    username: string,
    email: string,
  ): Promise<UserAccount | null> {
    return this.findAccountWithManager(this.dataSource.manager, externalUserId, username, email);
  }

  async upsertUserAndSession(
    input: SyncUserSessionInput,
  ): Promise<{ user: UserAccount; session: DeviceSession }> {
    return this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(UserAccount);
      const sessionRepo = manager.getRepository(DeviceSession);
      const now = new Date();

      const existingUser = await this.findAccountWithManager(
        manager,
        input.externalUserId,
        input.username,
        input.email,
      );

      if (existingUser && !existingUser.isActive) {
        throw new UnauthorizedException('La cuenta de usuario se encuentra inactiva.');
      }

      const userToSave = existingUser
        ? userRepo.merge(existingUser, {
            externalUserId: input.externalUserId ?? existingUser.externalUserId,
            username: input.username.trim(),
            email: input.email.trim().toLowerCase(),
            rol: input.rol,
            lastSyncedAt: now,
          })
        : userRepo.create({
            externalUserId: input.externalUserId,
            username: input.username.trim(),
            email: input.email.trim().toLowerCase(),
            rol: input.rol,
            isActive: true,
            lastSyncedAt: now,
          });

      const savedUser = await userRepo.save(userToSave);

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

      return {
        user: savedUser,
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
    externalUserId: string | null,
    username: string,
    email: string,
  ): Promise<UserAccount | null> {
    const userRepo = manager.getRepository(UserAccount);

    if (externalUserId) {
      const byExternal = await userRepo.findOne({
        where: { externalUserId },
      });
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

    return null;
  }
}
