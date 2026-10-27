import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { DeviceSession } from '../../modules/auth-session/entities/device-session.entity';
import type { IDeviceSessionReader } from './interfaces/i-device-session-reader';
import type { SessionContext } from './interfaces/session-context.interface';

@Injectable()
export class DeviceSessionReaderRepository implements IDeviceSessionReader {
  constructor(
    @InjectRepository(DeviceSession)
    private readonly deviceSessionRepository: Repository<DeviceSession>,
  ) {}

  async findSessionContext(sessionId: string, token: string): Promise<SessionContext | null> {
    const session = await this.deviceSessionRepository
      .createQueryBuilder('ds')
      .leftJoinAndSelect('ds.userAccount', 'ua')
      .where('ds.id = :sessionId', { sessionId })
      .getOne();

    if (!session || session.deviceToken !== token) {
      return null;
    }

    const account = session.userAccount ?? null;

    return {
      sessionId: session.id,
      userAccountId: session.userAccountId,
      username: account ? account.username : null,
      rol: account ? account.rol : null,
      externalRoles: account ? (account.externalRoles ?? [account.rol]) : [],
      localRole: account ? account.localRole : null,
      nickname: session.nickname,
      roleTag: session.roleTag,
      consentAcceptedAt: session.consentAcceptedAt,
      isAccountActive: account ? account.isActive : null,
    };
  }
}
