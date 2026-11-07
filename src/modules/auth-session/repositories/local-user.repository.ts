import { Injectable, UnauthorizedException } from '@nestjs/common';
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

/**
 * Repositorio de sincronización transaccional de cuentas (`UserAccount`), perfiles (`Actor`)
 * y sesiones por dispositivo (`DeviceSession`) en `ASISCONEXION_DB`.
 */
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
    return this.findAccount(this.dataSource.manager, externalUserId, username, email);
  }

  async upsertUserAndSession(
    input: SyncUserSessionInput,
  ): Promise<{ user: UserAccount; actor: Actor; session: DeviceSession }> {
    return this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(UserAccount);
      const actorRepo = manager.getRepository(Actor);
      const sessionRepo = manager.getRepository(DeviceSession);
      const now = new Date();

      const existingUser = await this.findAccount(
        manager,
        input.externalUserId,
        input.username,
        input.email,
      );
      if (existingUser && !existingUser.isActive) {
        throw new UnauthorizedException('La cuenta de usuario se encuentra inactiva.');
      }

      const externalRoles =
        input.externalRoles && input.externalRoles.length > 0
          ? [...input.externalRoles]
          : [input.rol];

      const user = await userRepo.save(
        existingUser
          ? userRepo.merge(existingUser, {
              externalUserId: input.externalUserId ?? existingUser.externalUserId,
              username: input.username.trim(),
              email: input.email.trim().toLowerCase(),
              rol: input.rol,
              externalRoles,
              lastSyncedAt: now,
            })
          : userRepo.create({
              externalUserId: input.externalUserId,
              username: input.username.trim(),
              email: input.email.trim().toLowerCase(),
              rol: input.rol,
              externalRoles,
              localRole: null,
              isActive: true,
              lastSyncedAt: now,
            }),
      );

      const existingActor = await actorRepo.findOne({ where: { userAccountId: user.id } });
      const actor = await actorRepo.save(
        existingActor
          ? actorRepo.merge(existingActor, { primaryRole: existingActor.primaryRole || user.rol })
          : actorRepo.create({
              userAccountId: user.id,
              primaryRole: user.rol,
              firstNames: null,
              lastNames: null,
              avatarUrl: null,
              shortBio: null,
            }),
      );

      const anonSession = input.existingAnonymousSessionId
        ? await sessionRepo.findOne({
            where: { id: input.existingAnonymousSessionId },
          })
        : null;
      const targetSession = anonSession?.userAccountId === null ? anonSession : null;
      const sessionId = targetSession?.id ?? randomUUID();

      const deviceToken = input.signSessionToken({
        sessionId,
        userAccountId: user.id,
        role: user.rol,
      });

      const session = await sessionRepo.save(
        targetSession
          ? sessionRepo.merge(targetSession, {
              userAccountId: user.id,
              deviceToken,
              nickname: user.username,
              roleTag: user.rol,
              consentAcceptedAt: now,
            })
          : sessionRepo.create({
              id: sessionId,
              userAccountId: user.id,
              deviceToken,
              nickname: user.username,
              roleTag: user.rol,
              consentAcceptedAt: now,
            }),
      );

      return { user, actor, session };
    });
  }

  async createAnonymousSession(input: CreateAnonymousSessionInput): Promise<DeviceSession> {
    const sessionRepo = this.dataSource.getRepository(DeviceSession);
    const sessionId = randomUUID();
    const nickname = input.nickname?.trim() || null;
    const roleTag = input.roleTag?.trim() || null;

    const deviceToken = input.signSessionToken({
      sessionId,
      userAccountId: null,
      role: roleTag ?? 'VISITANTE',
    });

    return sessionRepo.save(
      sessionRepo.create({
        id: sessionId,
        userAccountId: null,
        deviceToken,
        nickname,
        roleTag,
        consentAcceptedAt: new Date(),
      }),
    );
  }

  private async findAccount(
    manager: EntityManager,
    externalUserId: number | null,
    username: string,
    email: string,
  ): Promise<UserAccount | null> {
    const repo = manager.getRepository(UserAccount);
    if (externalUserId !== null && externalUserId !== undefined) {
      const byExt = await repo.findOne({ where: { externalUserId } });
      if (byExt) return byExt;
    }

    const cleanUser = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanUser && !cleanEmail) return null;

    return repo
      .createQueryBuilder('u')
      .where('LOWER(u.username) = :cleanUser OR LOWER(u.email) = :cleanEmail', {
        cleanUser,
        cleanEmail,
      })
      .getOne();
  }
}
